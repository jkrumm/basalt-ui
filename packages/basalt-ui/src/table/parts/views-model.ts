/**
 * Saved views, as pure values (docs/v3/concepts/data-table.md sections 3 and 6). A view stores
 * explicit values: `q`, filters, sort, page size, the columns (visibility, order, pins, widths), the
 * row height, the grouping, the footer reduces and the layout, never the page. A view stored before
 * the layout existed has none and draws as a table. It lives
 * on the device at `basalt:table-views:<id>` in the frozen `{v,value}` envelope; the list's order is
 * the tabs' order. Version 2 added `default` and `sharing`; a version 1 list migrates as it is, any
 * other version is discarded instead of read wrong.
 *
 * Law:
 * - Same name, same view: saving a name that exists overwrites it in place and keeps its id.
 * - A view applied to a table that lost a column is pruned, never rejected: filters, sort and
 *   visibility entries on unknown ids are dropped and named.
 * - A view is "clean" while the table state equals it (the page excluded). An edit keeps
 *   `?view=<id>` and makes the view read modified until it is saved or discarded.
 * - At most one view is the default; `all` (`BASE_VIEW`) names the declared table and is never
 *   handed out as an id.
 */
import { persisted } from '../../core/persisted'
import type { Persisted, PersistedSchema } from '../../core/persisted'
import type { TableDisplay, TableState, View } from '../contract'
import { sameScope } from '../core/state'

/** The envelope version of the views store. Bump when `View` changes shape. */
export const VIEWS_VERSION = 2

/** The id `?view=` holds for the declared table while a default view exists; never a saved view's. */
export const BASE_VIEW = 'all'

/** The persisted key (the store adds the `basalt:` namespace): `basalt:table-views:<id>`. */
export const viewsKey = (tableId: string): string => `table-views:${tableId}`

const isView = (value: unknown): value is View => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<View>
  return (
    (v.default === undefined || typeof v.default === 'boolean') &&
    (v.sharing === undefined || v.sharing === 'private' || v.sharing === 'shared') &&
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.state === 'object' &&
    v.state !== null &&
    typeof v.state.request === 'object' &&
    v.state.request !== null &&
    typeof v.state.display === 'object' &&
    v.state.display !== null
  )
}

const schema: PersistedSchema<View[]> = {
  '~standard': {
    validate: (value) =>
      Array.isArray(value) && value.every(isView)
        ? { value: value as View[] }
        : { issues: [{ message: 'not a list of views' }] },
  },
}

/** The device store of a table's views. One definition per table id. */
export function viewsStore(tableId: string): Persisted<View[]> {
  return persisted<View[]>(viewsKey(tableId), {
    version: VIEWS_VERSION,
    initial: [],
    schema,
    migrate: migrateViews,
  })
}

/** A version 1 list is a version 2 list without a default or a sharing; any other version is lost. */
export function migrateViews(old: unknown, from: number): View[] {
  if (from !== 1 || !Array.isArray(old)) return []
  return old.filter(isView)
}

// ---- Values -------------------------------------------------------------------------------

/** The hidden columns of a visibility map, sorted; `true` and absent both mean shown. */
const hidden = (visibility: Record<string, boolean>): string =>
  Object.entries(visibility)
    .filter(([, shown]) => !shown)
    .map(([id]) => id)
    .toSorted()
    .join('\u0000')

/** A stored id list as one comparable string; absent and empty are the same. */
const listKey = (ids: readonly string[] | undefined): string => (ids ?? []).join('\u0000')

/** A stored map by column id as one comparable string; absent and empty are the same. */
const mapKey = (map: Readonly<Record<string, unknown>> | undefined): string =>
  JSON.stringify(Object.entries(map ?? {}).toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))

/** The view properties beyond the columns: the row height, the grouping, the reduces and the layout. */
const viewKey = (display: TableState['display']): string =>
  JSON.stringify([
    mapKey(display.widths),
    display.rowHeight ?? '',
    display.groupBy === undefined ? '' : display.groupBy === null ? '\u0000' : display.groupBy,
    mapKey(display.aggregates),
    display.layout === undefined || display.layout === 'table' ? '' : display.layout,
  ])

/** Whether the table state differs from the view in anything the view carries. The page never counts. */
export function isViewDirty(view: View, state: TableState): boolean {
  const saved = view.state.display
  const now = state.display
  return (
    !sameScope(view.state.request, state.request) ||
    hidden(saved.visibility) !== hidden(now.visibility) ||
    listKey(saved.order) !== listKey(now.order) ||
    listKey([...(saved.pinned ?? [])].toSorted()) !== listKey([...(now.pinned ?? [])].toSorted()) ||
    viewKey(saved) !== viewKey(now)
  )
}

/** A view without the columns the table does not have. `dropped` names what went. */
export function pruneView(
  view: View,
  known: ReadonlySet<string>,
): { view: View; dropped: string[] } {
  const { request, display } = view.state
  const dropped: string[] = []
  const keep = <E>(entries: readonly E[], id: (entry: E) => string): E[] =>
    entries.filter((entry) => {
      const ok = known.has(id(entry))
      if (!ok) dropped.push(id(entry))
      return ok
    })
  const ranks: Record<string, readonly string[]> = {}
  for (const [id, order] of Object.entries(request.ranks ?? {})) {
    if (known.has(id)) ranks[id] = order
    else dropped.push(id)
  }
  const visibility: Record<string, boolean> = {}
  for (const [id, shown] of Object.entries(display.visibility)) {
    if (known.has(id)) visibility[id] = shown
    else dropped.push(id)
  }
  const ids = (list: readonly string[] | undefined): string[] | undefined =>
    list === undefined
      ? undefined
      : list.filter((id) => {
          if (!known.has(id) && !dropped.includes(id)) dropped.push(id)
          return known.has(id)
        })
  const order = ids(display.order)
  const pinned = ids(display.pinned)
  const byColumn = <V>(
    map: Readonly<Record<string, V>> | undefined,
  ): Record<string, V> | undefined => {
    if (map === undefined) return undefined
    const kept: Record<string, V> = {}
    for (const [id, value] of Object.entries(map)) {
      if (known.has(id)) kept[id] = value
      else if (!dropped.includes(id)) dropped.push(id)
    }
    return kept
  }
  const widths = byColumn(display.widths)
  const aggregates = byColumn(display.aggregates)
  const groupGone =
    typeof display.groupBy === 'string' && !known.has(display.groupBy) ? display.groupBy : undefined
  if (groupGone !== undefined && !dropped.includes(groupGone)) dropped.push(groupGone)
  const { groupBy: _groupBy, ...kept } = display
  return {
    dropped,
    view: {
      ...view,
      state: {
        ...view.state,
        request: {
          ...request,
          filters: keep(request.filters, (f) => f.id),
          sort: keep(request.sort, (s) => s.id),
          ...(request.ranks !== undefined && { ranks }),
        },
        display: {
          ...(groupGone === undefined ? display : kept),
          visibility,
          ...(order !== undefined && { order }),
          ...(pinned !== undefined && { pinned }),
          ...(widths !== undefined && { widths }),
          ...(aggregates !== undefined && { aggregates }),
        },
      },
    },
  }
}

/**
 * The display a table takes when it applies a view: the view's columns, widths, row height, grouping
 * and reduces, each restored to the declared one where the view carries none (a view saved before a
 * property existed), so the table equals the view it applied. The open and closed groups stay the
 * device's while the grouping holds.
 */
export function viewDisplay(prev: TableDisplay, saved: TableDisplay): TableDisplay {
  const { rowHeight: _rowHeight, groupBy: _groupBy, layout: _layout, ...rest } = prev
  const sameGroup = prev.groupBy === saved.groupBy
  return {
    ...rest,
    visibility: saved.visibility,
    order: saved.order ?? [],
    pinned: saved.pinned ?? [],
    widths: saved.widths ?? {},
    aggregates: saved.aggregates ?? {},
    ...(saved.rowHeight !== undefined && { rowHeight: saved.rowHeight }),
    ...(saved.groupBy !== undefined && { groupBy: saved.groupBy }),
    ...(saved.layout !== undefined && saved.layout !== 'table' && { layout: saved.layout }),
    ...(!sameGroup && { collapsed: [] }),
  }
}

const slug = (name: string): string =>
  name
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, '-')
    .replaceAll(/^-+|-+$/g, '') || 'view'

/** The state as a view stores it: explicit values only, and page 1. */
export function storedState(state: TableState): TableState {
  const { display } = state
  return {
    v: 1 as const,
    request: { ...state.request, page: 1 },
    display: {
      visibility: { ...display.visibility },
      ...((display.order?.length ?? 0) > 0 && { order: [...(display.order ?? [])] }),
      ...((display.pinned?.length ?? 0) > 0 && { pinned: [...(display.pinned ?? [])] }),
      ...(Object.keys(display.widths ?? {}).length > 0 && { widths: { ...display.widths } }),
      ...(display.rowHeight !== undefined && { rowHeight: display.rowHeight }),
      ...(display.groupBy !== undefined && { groupBy: display.groupBy }),
      ...(Object.keys(display.aggregates ?? {}).length > 0 && {
        aggregates: { ...display.aggregates },
      }),
      ...(display.layout !== undefined && display.layout !== 'table' && { layout: display.layout }),
    },
  }
}

/** An id from the name that no view holds and that is never `BASE_VIEW`. */
function freeId(views: readonly View[], name: string): string {
  const taken = new Set([BASE_VIEW, ...views.map((view) => view.id)])
  const base = slug(name)
  let id = base
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`
  return id
}

/** `base` when no view holds it, else `base 2`, `base 3`, ... */
export function freeName(views: readonly View[], base: string): string {
  const taken = new Set(views.map((view) => view.name))
  let name = base.trim()
  for (let n = 2; taken.has(name); n += 1) name = `${base.trim()} ${n}`
  return name
}

/**
 * `views` with the current state saved under `name`. An existing name is overwritten and keeps its
 * id, its default and its sharing; a new one gets an id from the name, made unique. The page is not stored.
 */
export function saveView(
  views: readonly View[],
  name: string,
  state: TableState,
): { views: View[]; id: string } {
  const clean = name.trim()
  const stored = storedState(state)
  const existing = views.find((view) => view.name === clean)
  if (existing !== undefined) {
    return {
      id: existing.id,
      views: views.map((view) => (view === existing ? { ...view, state: stored } : view)),
    }
  }
  const id = freeId(views, clean)
  return { id, views: [...views, { id, name: clean, state: stored }] }
}

/** `views` with `id`'s state replaced by `state` (Save on a modified view). */
export function storeView(views: readonly View[], id: string, state: TableState): View[] {
  const stored = storedState(state)
  return views.map((view) => (view.id === id ? { ...view, state: stored } : view))
}

/**
 * `views` with `id` renamed. `undefined` when the name is blank or another view holds it, since the
 * name is how a save finds a view.
 */
export function renameView(views: readonly View[], id: string, name: string): View[] | undefined {
  const clean = name.trim()
  if (clean === '' || views.some((view) => view.id !== id && view.name === clean)) return undefined
  return views.map((view) => (view.id === id ? { ...view, name: clean } : view))
}

/** A copy of `id` right after it, under a free name, never the default; `undefined` for an unknown id. */
export function duplicateView(
  views: readonly View[],
  id: string,
  name: string,
): { views: View[]; id: string } | undefined {
  const at = views.findIndex((view) => view.id === id)
  const source = views[at]
  if (source === undefined) return undefined
  const copyName = freeName(views, name)
  const { default: _default, ...rest } = source
  const copy: View = { ...rest, id: freeId(views, copyName), name: copyName }
  return { id: copy.id, views: [...views.slice(0, at + 1), copy, ...views.slice(at + 1)] }
}

/** `views` with `id` moved to index `to`, clamped to the list. */
export function moveView(views: readonly View[], id: string, to: number): View[] {
  const from = views.findIndex((view) => view.id === id)
  const moved = views[from]
  if (moved === undefined) return [...views]
  const rest = views.filter((view) => view.id !== id)
  const at = Math.max(0, Math.min(to, rest.length))
  return [...rest.slice(0, at), moved, ...rest.slice(at)]
}

/** `views` with `id` the one default (`undefined` for none): the flag moves, never doubles. */
export function setDefaultView(views: readonly View[], id: string | undefined): View[] {
  return views.map((view) => {
    const { default: _default, ...rest } = view
    return view.id === id ? { ...rest, default: true } : rest
  })
}

/** `views` with `id`'s sharing set. */
export function shareView(
  views: readonly View[],
  id: string,
  sharing: NonNullable<View['sharing']>,
): View[] {
  return views.map((view) => (view.id === id ? { ...view, sharing } : view))
}

/** The default view, if one is marked. */
export const defaultView = (views: readonly View[]): View | undefined =>
  views.find((view) => view.default === true)

/**
 * Whether the table differs from its declared self in anything a view carries, the sort aside (the
 * declared sort is the codec's, which the views never see): the base tab reads modified then.
 */
export function isBaseDirty(state: TableState): boolean {
  const { request, display } = state
  return (
    request.q !== '' ||
    request.filters.length > 0 ||
    Object.keys(request.ranks ?? {}).length > 0 ||
    hidden(display.visibility) !== '' ||
    (display.order?.length ?? 0) > 0 ||
    (display.pinned?.length ?? 0) > 0 ||
    viewKey(display) !== viewKey({ visibility: {} })
  )
}
