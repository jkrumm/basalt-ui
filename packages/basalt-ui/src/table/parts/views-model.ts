/**
 * Saved views, as pure values (docs/v3/concepts/data-table.md sections 3 and 6). A view stores
 * explicit values: `q`, filters, sort, page size, the columns (visibility, order, pins, widths), the
 * row height, the grouping and the footer reduces, never the page. It lives
 * on the device at `basalt:table-views:<id>` in the frozen `{v,value}` envelope, so a bumped
 * version discards what an older shape wrote instead of reading it wrong.
 *
 * Law:
 * - Same name, same view: saving a name that exists overwrites it in place and keeps its id.
 * - A view applied to a table that lost a column is pruned, never rejected: filters, sort and
 *   visibility entries on unknown ids are dropped and named.
 * - A view is "clean" while the table state equals it (the page excluded). `?view=<id>` is only
 *   ever written while clean; any edit makes the state differ and the id goes.
 */
import { persisted } from '../../core/persisted'
import type { Persisted, PersistedSchema } from '../../core/persisted'
import type { TableDisplay, TableState, View } from '../contract'
import { sameScope } from '../core/state'

/** The envelope version of the views store. Bump when `View` changes shape. */
export const VIEWS_VERSION = 1

/** The persisted key (the store adds the `basalt:` namespace): `basalt:table-views:<id>`. */
export const viewsKey = (tableId: string): string => `table-views:${tableId}`

const isView = (value: unknown): value is View => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Partial<View>
  return (
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
  return persisted<View[]>(viewsKey(tableId), { version: VIEWS_VERSION, initial: [], schema })
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

/** The view properties beyond the columns: the row height, the grouping and the reduces. */
const viewKey = (display: TableState['display']): string =>
  JSON.stringify([
    mapKey(display.widths),
    display.rowHeight ?? '',
    display.groupBy === undefined ? '' : display.groupBy === null ? '\u0000' : display.groupBy,
    mapKey(display.aggregates),
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
  const { rowHeight: _rowHeight, groupBy: _groupBy, ...rest } = prev
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
    ...(!sameGroup && { collapsed: [] }),
  }
}

const slug = (name: string): string =>
  name
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}]+/gu, '-')
    .replaceAll(/^-+|-+$/g, '') || 'view'

/**
 * `views` with the current state saved under `name`. An existing name is overwritten and keeps its
 * id; a new one gets an id from the name, made unique. The page is not stored.
 */
export function saveView(
  views: readonly View[],
  name: string,
  state: TableState,
): { views: View[]; id: string } {
  const clean = name.trim()
  const stored = {
    v: 1 as const,
    request: { ...state.request, page: 1 },
    display: {
      visibility: { ...state.display.visibility },
      ...((state.display.order?.length ?? 0) > 0 && { order: [...(state.display.order ?? [])] }),
      ...((state.display.pinned?.length ?? 0) > 0 && {
        pinned: [...(state.display.pinned ?? [])],
      }),
      ...(Object.keys(state.display.widths ?? {}).length > 0 && {
        widths: { ...state.display.widths },
      }),
      ...(state.display.rowHeight !== undefined && { rowHeight: state.display.rowHeight }),
      ...(state.display.groupBy !== undefined && { groupBy: state.display.groupBy }),
      ...(Object.keys(state.display.aggregates ?? {}).length > 0 && {
        aggregates: { ...state.display.aggregates },
      }),
    },
  }
  const existing = views.find((view) => view.name === clean)
  if (existing !== undefined) {
    return {
      id: existing.id,
      views: views.map((view) => (view === existing ? { ...view, state: stored } : view)),
    }
  }
  const taken = new Set(views.map((view) => view.id))
  const base = slug(clean)
  let id = base
  for (let n = 2; taken.has(id); n += 1) id = `${base}-${n}`
  return { id, views: [...views, { id, name: clean, state: stored }] }
}
