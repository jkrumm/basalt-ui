/**
 * Saved views as tabs (docs/v3/concepts/data-table.md sections 3 and 6). A view is a named table
 * state; the strip draws the declared table (`All rows`) and one tab per view, in the store's order,
 * and `+ View` saves what is shown as a new one. The active tab opens its own menu. Views are
 * personal and live on the device (`views-model.ts`) unless the caller hands `useDataTable` a
 * `ViewStore` (`views: { store }`): then every write goes through it, a refused write leaves the
 * list as it was and says so, and the store's capabilities decide what the strip and the panel offer
 * (`reorder`, `share`, `count`).
 *
 * `?view=<id>` names the applied view. An edit keeps it and the view reads modified, with Save and
 * Discard, until one of them runs. A default view is applied once per mount when the address names
 * none; the declared table is then `?view=all`, so a reload stays on it. An address whose table
 * request is explicit (a search, a filter) wins over the view it names: the view is not re-applied
 * over it. The id is read and written on the address bar (`replace`, never a push) unless the caller
 * binds it to its own route search through `view`.
 */
import { Suspense, lazy, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ComponentType, MouseEvent, ReactElement } from 'react'
import { useMessages } from '../../core/messages/use-messages'
import { table } from '../../core/messages/table'
import { useDebouncedCallback } from '../../core/debounce'
import type { ControlHandle, ControlsSlot } from '../../core/ports'
import type { PageLayout, PageSearch, PageSettings } from '../../page/contract'
import { Button } from '../../ui/button'
import { Tabs, TabsList, TabsTrigger } from '../../ui/tabs'
import type { DataTableInstance, TableState, View, ViewStore } from '../contract'
import type { AddViewMenuProps } from '../layouts/add-menu'
import { LayoutToggle, layoutHandle, useLayoutLabel, useLayoutOptions } from '../layouts/toggle'
import { SEARCH_DEBOUNCE_MS } from '../core/state'
import { modelOf } from '../use-data-table'
import type { TableModel } from '../use-data-table'
import { AddFilter } from './add-filter'
import { PlusGlyph } from './plus-glyph'
import { ChipList } from './chips'
import { useSearchLabel } from './search-label'
import { filterableSpecs } from './toolbar-filters'
import { setDoor, useDoor, useMountDoor } from './view-door'
import type { TabMenuProps } from './view-tab-menu'
import type { DoorState, PanelPage } from './view-door'
import {
  BASE_VIEW,
  defaultView,
  duplicateView,
  freeName,
  isBaseDirty,
  isViewDirty,
  moveView,
  pruneView,
  renameView,
  saveView,
  setDefaultView,
  shareView,
  storeView,
  viewDisplay,
  viewsStore,
} from './views-model'

/** The applied view's id, and the write that changes it. */
export type ViewParam = { id: string | undefined; set(id: string | undefined): void }

const PARAM = 'view'

function readParam(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return new URLSearchParams(window.location.search).get(PARAM) ?? undefined
}

/** `?view=` on the address bar, replaced in place so the back button is not spent on it. */
function useAddressParam(): ViewParam {
  const [id, setId] = useState<string | undefined>(readParam)
  return {
    id,
    set(next) {
      const url = new URL(window.location.href)
      if (next === undefined) url.searchParams.delete(PARAM)
      else url.searchParams.set(PARAM, next)
      window.history.replaceState(window.history.state, '', url)
      setId(next)
    },
  }
}

function warnPruned(table: string, view: string, dropped: readonly string[]): void {
  if (dropped.length === 0 || process.env.NODE_ENV === 'production') return
  // oxlint-disable-next-line no-console -- a development warning for a stale saved view
  console.warn(
    `basalt-ui/table: view "${view}" of "${table}" names columns the table no longer has (${dropped.join(', ')}); they were dropped`,
  )
}

function applyView<T>(model: TableModel<T>, view: View): void {
  const known = new Set(model.specs.map((spec) => spec.id))
  const { view: pruned, dropped } = pruneView(view, known)
  warnPruned(model.id, view.name, dropped)
  const { request, display } = pruned.state
  model.state.setRequest({
    q: request.q,
    filters: request.filters,
    sort: request.sort,
    pageSize: request.pageSize,
    // A view without ranks restores the declared order, so the table equals the view it applied.
    ranks: request.ranks ?? {},
  })
  // A view saved before a property existed (order, pins, widths, ...) restores the declared one.
  model.state.updateDisplay((prev) => viewDisplay(prev, display))
}

/** The declared table: no search, no filter, no rank, and every display property as declared. */
function applyBase<T>(model: TableModel<T>): void {
  model.state.setRequest({ q: '', filters: [], ranks: {} })
  model.state.updateDisplay((prev) => viewDisplay(prev, { visibility: {} }))
}

/** Whether the request carries nothing a reader chose: an address like that takes the named view. */
const isPristine = (state: TableState): boolean =>
  state.request.q === '' &&
  state.request.filters.length === 0 &&
  Object.keys(state.request.ranks ?? {}).length === 0

/** The views of a table and the one write on them; the same shape on the device and on a store. */
export type ViewList = {
  views: readonly View[]
  ready: boolean
  failed: boolean
  canReorder: boolean
  canShare: boolean
  /** Each view's row count, by id, when the store counts. */
  counts: Readonly<Record<string, number>>
  /** Writes the whole list; `false` when the store refused, and the list stays as it was. */
  commit(next: readonly View[]): Promise<boolean>
}

const same = (a: View, b: View): boolean => JSON.stringify(a) === JSON.stringify(b)

/** What `next` changes against `prev`, as the store's calls: removes, saves, and an order write. */
async function writeStore(
  store: ViewStore,
  tableId: string,
  prev: readonly View[],
  next: readonly View[],
): Promise<void> {
  const byId = new Map(prev.map((view) => [view.id, view]))
  const kept = new Set(next.map((view) => view.id))
  for (const view of prev) if (!kept.has(view.id)) await store.remove(tableId, view.id)
  for (const view of next) {
    const was = byId.get(view.id)
    if (was === undefined || !same(was, view)) await store.save(tableId, view)
  }
  // A store appends what it saves: the order differs from `next` when a kept view moved or a new one
  // sits anywhere but last (a duplicate lands right after its source).
  const order = next.map((view) => view.id)
  const appended = [
    ...prev.map((view) => view.id).filter((id) => kept.has(id)),
    ...order.filter((id) => !byId.has(id)),
  ]
  if (store.reorder !== undefined && appended.join('\u0000') !== order.join('\u0000')) {
    await store.reorder(tableId, order)
  }
}

/** The list of a caller's `ViewStore`: read once on mount, then kept in step with each write. */
function useStoreViews(
  store: ViewStore | undefined,
  tableId: string,
  matched: number | undefined,
): ViewList | undefined {
  const [loaded, setLoaded] = useState<readonly View[]>([])
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  const [counts, setCounts] = useState<Readonly<Record<string, number>>>({})
  useEffect(() => {
    if (store === undefined) return
    let live = true
    store.list(tableId).then(
      (list) => {
        if (!live) return
        setLoaded(list)
        setReady(true)
      },
      () => {
        if (!live) return
        // an unreadable store has no view to apply: settle on the empty list so a stale `?view=` goes
        setFailed(true)
        setReady(true)
      },
    )
    return () => {
      live = false
    }
  }, [store, tableId])
  // The counts follow the list and the table's own matched rows, the sign that the data moved.
  const count = store?.count
  useEffect(() => {
    if (count === undefined || loaded.length === 0) return
    let live = true
    const read = async (): Promise<void> => {
      const pairs = await Promise.all(
        loaded.map(async (view) => {
          try {
            return [view.id, await count.call(store, tableId, view)] as const
          } catch {
            return [view.id, undefined] as const
          }
        }),
      )
      if (!live) return
      const known: Record<string, number> = {}
      for (const [id, n] of pairs) if (n !== undefined) known[id] = n
      setCounts(known)
    }
    void read()
    return () => {
      live = false
    }
    // oxlint-disable-next-line react/exhaustive-effect-dependencies -- `matched` is the sign the data moved, so the counts are read again
  }, [count, store, tableId, loaded, matched])
  if (store === undefined) return undefined
  return {
    views: loaded,
    ready,
    failed,
    canReorder: store.reorder !== undefined,
    canShare: store.share === true,
    counts,
    async commit(next) {
      try {
        await writeStore(store, tableId, loaded, next)
      } catch {
        setFailed(true)
        return false
      }
      setFailed(false)
      setLoaded(next)
      return true
    },
  }
}

const noSubscribe = (): (() => void) => () => {}
const isClient = (): boolean => true
const isServer = (): boolean => false

/** The views of one model: its `ViewStore` when the caller gave one, else the device store. */
function useViews<T>(model: TableModel<T>): ViewList {
  const device = viewsStore(model.id)
  const [onDevice] = device.use()
  // A hydration render reads the server snapshot (no views): the list is ready on the client snapshot only.
  const hydrated = useSyncExternalStore(noSubscribe, isClient, isServer)
  const remote = useStoreViews(model.viewStore, model.id, model.count)
  if (remote !== undefined) return remote
  return {
    views: onDevice,
    ready: hydrated,
    failed: false,
    canReorder: true,
    canShare: false,
    counts: {},
    commit(next) {
      device.set([...next])
      return Promise.resolve(true)
    },
  }
}

/** Everything the strip and the panel read and write: one per drawn set of views. */
export type ViewsController<T> = {
  model: TableModel<T>
  list: ViewList
  /** The applied saved view; `undefined` on the declared table. */
  active: View | undefined
  /** The table differs from the active view, or from the declared table on `All rows`. */
  modified: boolean
  door: DoorState
  show(page?: PanelPage): void
  close(): void
  apply(id: string | undefined): void
  /** Saves what is shown as a new view (in `layout` when given), applies it and opens the panel on its name. */
  create(layout?: string): Promise<void>
  save(): Promise<void>
  discard(): void
  rename(id: string, name: string): Promise<boolean>
  duplicate(id: string): Promise<void>
  move(id: string, by: number): Promise<void>
  setDefault(id: string | undefined): Promise<void>
  share(id: string, sharing: NonNullable<View['sharing']>): Promise<void>
  remove(id: string): Promise<void>
  /** The address of the active view, for Copy link. */
  link(): string
  onExport: (() => void) | undefined
}

export type TableViewsOptions = {
  /** Binds the applied view's id to the route's own search; the address bar's `?view=` when omitted. */
  view?: ViewParam
  /** Draws Export in the tab menu and the panel; the app writes the file (`docs/recipes/csv-export.md`). */
  onExport?: () => void
}

function useViewsController<T>(
  model: TableModel<T>,
  options: TableViewsOptions,
): ViewsController<T> {
  const t = useMessages(table)
  const own = useAddressParam()
  const param = options.view ?? own
  const list = useViews(model)
  const door = useDoor(model.id)
  useMountDoor(model.id)
  const state = model.state.state
  const known = new Set(model.specs.map((spec) => spec.id))
  const active =
    param.id === undefined || param.id === BASE_VIEW
      ? undefined
      : list.views.find((view) => view.id === param.id)
  const modified =
    active === undefined ? isBaseDirty(state) : isViewDirty(pruneView(active, known).view, state)

  // Once the list is known: a named view applies over a pristine request, a bare address takes the
  // default. An id no view holds goes, then and whenever the list loses it.
  const settled = useRef(false)
  useEffect(() => {
    if (!list.ready) return
    const named = active
    if (param.id !== undefined && param.id !== BASE_VIEW && named === undefined) {
      param.set(undefined)
      return
    }
    if (settled.current) return
    settled.current = true
    if (!isPristine(state)) return
    if (named !== undefined) {
      applyView(model, named)
      return
    }
    const fallback = param.id === undefined ? defaultView(list.views) : undefined
    if (fallback === undefined) return
    applyView(model, fallback)
    param.set(fallback.id)
  })

  const show = (page?: PanelPage): void => setDoor(model.id, { open: true, page: page ?? 'root' })
  const commit = (next: readonly View[]): Promise<boolean> => list.commit(next)

  const apply = (id: string | undefined): void => {
    const view = id === undefined ? undefined : list.views.find((v) => v.id === id)
    if (view === undefined) {
      applyBase(model)
      param.set(defaultView(list.views) === undefined ? undefined : BASE_VIEW)
      return
    }
    applyView(model, view)
    param.set(view.id)
  }

  return {
    model,
    list,
    active,
    modified,
    door,
    show,
    close: () => setDoor(model.id, { open: false, page: door.page }),
    apply,
    async create(layout) {
      const { layout: _shown, ...display } = state.display
      const start =
        layout === undefined
          ? state
          : { ...state, display: layout === 'table' ? display : { ...display, layout } }
      const saved = saveView(list.views, freeName(list.views, t('table.viewNew')), start)
      if (!(await commit(saved.views))) return
      if (layout !== undefined) model.setLayout(layout)
      param.set(saved.id)
      show('name')
    },
    async save() {
      if (active !== undefined) {
        await commit(storeView(list.views, active.id, state))
        return
      }
      const saved = saveView(list.views, freeName(list.views, t('table.viewNew')), state)
      if (!(await commit(saved.views))) return
      param.set(saved.id)
      show('name')
    },
    discard() {
      if (active === undefined) applyBase(model)
      else applyView(model, active)
    },
    async rename(id, name) {
      const renamed = renameView(list.views, id, name)
      return renamed === undefined ? false : commit(renamed)
    },
    async duplicate(id) {
      const source = list.views.find((view) => view.id === id)
      if (source === undefined) return
      const copied = duplicateView(list.views, id, t('table.viewCopyOf', source.name))
      const copy = copied?.views.find((view) => view.id === copied.id)
      if (copied === undefined || copy === undefined || !(await commit(copied.views))) return
      applyView(model, copy)
      param.set(copy.id)
    },
    async move(id, by) {
      const at = list.views.findIndex((view) => view.id === id)
      if (at >= 0) await commit(moveView(list.views, id, at + by))
    },
    async setDefault(id) {
      if (!(await commit(setDefaultView(list.views, id)))) return
      // The declared table needs its own id once a default exists, or a reload would leave it.
      if (id !== undefined && param.id === undefined) param.set(BASE_VIEW)
      if (id === undefined && param.id === BASE_VIEW) param.set(undefined)
    },
    async share(id, sharing) {
      await commit(shareView(list.views, id, sharing))
    },
    async remove(id) {
      const kept = list.views.filter((view) => view.id !== id)
      if (!(await commit(kept))) return
      const fallback = defaultView(kept) === undefined ? undefined : BASE_VIEW
      if (param.id === id) {
        applyBase(model)
        param.set(fallback)
      } else if (param.id === BASE_VIEW && fallback === undefined) {
        // The declared table needs no id of its own once no default is left.
        param.set(undefined)
      }
    },
    link() {
      if (typeof window === 'undefined') return ''
      const url = new URL(window.location.href)
      if (active === undefined) url.searchParams.delete(PARAM)
      else url.searchParams.set(PARAM, active.id)
      return url.toString()
    },
    onExport: options.onExport,
  }
}

/**
 * The panel loads on its first open: its pages (radio groups, the filter editors, the order list)
 * stay out of every table's initial graph, and a page that never edits a view never fetches them.
 */
const LazyPanel = lazy(
  async (): Promise<{ default: ComponentType<{ c: ViewsController<unknown> }> }> => ({
    default: (await import('./view-panel')).ViewPanel,
  }),
)

/** The active tab's menu, a chunk of its own as well: `ui/menu` waits for the first click on a tab. */
const LazyTabMenu = lazy(async (): Promise<{ default: ComponentType<TabMenuProps> }> => ({
  default: (await import('./view-tab-menu')).TabMenu,
}))

/** `+ View`'s layout menu, with the tab menu's chunk timing: loaded on the first intent. */
const LazyAddMenu = lazy(async (): Promise<{ default: ComponentType<AddViewMenuProps> }> => ({
  default: (await import('../layouts/add-menu')).AddViewMenu,
}))

const preloadPanel = (): void => {
  void import('./view-panel')
  void import('./view-tab-menu')
}

const preloadAddMenu = (): void => {
  void import('../layouts/add-menu')
}

/** The panel while it is open, nothing while it is closed. */
function Panel<T>({ c }: { c: ViewsController<T> }): ReactElement | null {
  if (!c.door.open) return null
  return (
    <Suspense fallback={null}>
      <LazyPanel c={c as unknown as ViewsController<unknown>} />
    </Suspense>
  )
}

/** The dot an unsaved change puts on its tab, and the words a screen reader hears for it. */
function ModifiedMark(): ReactElement {
  const t = useMessages(table)
  return (
    <>
      <span
        aria-hidden="true"
        data-slot="table-view-modified"
        className="size-1.5 shrink-0 rounded-full bg-brand"
      />
      <span className="sr-only">{t('table.viewModified')}</span>
    </>
  )
}

/**
 * The strip: `All rows`, a pill tab per view with its count and a dot while modified, `+ View`, and
 * Save and Discard while the shown view differs. A click on the active tab opens its menu.
 */
export function ViewStrip<T>({ c }: { c: ViewsController<T> }): ReactElement {
  const t = useMessages(table)
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [adding, setAdding] = useState<HTMLElement | null>(null)
  const layouts = c.model.layouts.length > 1
  const value = c.active?.id ?? BASE_VIEW
  const menuFor = (id: string) => (event: MouseEvent<HTMLElement>) => {
    if (id === value) setAnchor(event.currentTarget)
  }
  return (
    // The panel's chunk is fetched on the first intent (a pointer or focus on the strip), so its open draws at once.
    <span
      data-slot="table-view-strip"
      className="flex min-w-0 items-center gap-1"
      onPointerEnter={preloadPanel}
      onFocus={preloadPanel}
    >
      <Tabs
        variant="pill"
        value={value}
        className="min-w-0"
        onValueChange={(next) => {
          c.apply(next === BASE_VIEW ? undefined : String(next))
        }}
      >
        <TabsList aria-label={t('table.views')} className="min-w-0 shrink">
          <TabsTrigger value={BASE_VIEW}>
            {t('table.viewNone')}
            {c.active === undefined && c.modified && <ModifiedMark />}
          </TabsTrigger>
          {c.list.views.map((view) => {
            const count = c.list.counts[view.id]
            const isActive = view.id === value
            return (
              <TabsTrigger
                key={view.id}
                value={view.id}
                data-view-id={view.id}
                {...(isActive && { 'aria-haspopup': 'menu' as const })}
                onClick={menuFor(view.id)}
              >
                <span className="max-w-48 truncate">{view.name}</span>
                {count !== undefined && (
                  <span
                    data-slot="table-view-count"
                    className="text-xs font-normal text-muted-foreground tabular-nums"
                  >
                    {count}
                  </span>
                )}
                {isActive && c.modified && <ModifiedMark />}
              </TabsTrigger>
            )
          })}
        </TabsList>
      </Tabs>
      <Button
        variant="ghost"
        size="sm"
        data-slot="table-view-add"
        aria-label={t('table.viewAdd')}
        className="pointer-coarse:min-w-11"
        {...(layouts && { 'aria-haspopup': 'menu' as const })}
        onPointerEnter={layouts ? preloadAddMenu : undefined}
        onClick={(event) => {
          if (layouts) setAdding(event.currentTarget)
          else void c.create()
        }}
      >
        <PlusGlyph />
        <span className="@max-regular:sr-only">{t('table.viewAddShort')}</span>
      </Button>
      {c.modified && (
        // Below the regular tier the tabs keep the room: Save and Discard move to the tab's menu and the panel.
        <span
          data-slot="table-view-pending"
          className="inline-flex shrink-0 items-center gap-1 @max-regular:hidden"
        >
          <Button variant="ghost" size="sm" onClick={c.discard}>
            {t('table.viewDiscard')}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => void c.save()}>
            {c.active === undefined ? t('table.viewSaveAs') : t('table.viewSave')}
          </Button>
        </span>
      )}
      {c.list.failed && (
        <span role="alert" className="text-xs text-muted-foreground">
          {t('table.viewFailed')}
        </span>
      )}
      {adding !== null && (
        <Suspense fallback={null}>
          <LazyAddMenu
            model={c.model as TableModel<unknown>}
            anchor={adding}
            onPick={(layout) => {
              setAdding(null)
              void c.create(layout)
            }}
            onClose={() => setAdding(null)}
          />
        </Suspense>
      )}
      {anchor !== null && c.active !== undefined && (
        <Suspense fallback={null}>
          <LazyTabMenu
            c={c as unknown as ViewsController<unknown>}
            view={c.active}
            anchor={anchor}
            onClose={() => setAnchor(null)}
          />
        </Suspense>
      )}
    </span>
  )
}

/** What `useTableViews` hands a page: the slots of `PageBar`'s one view row, the chips and the panel. */
export type TableViewsResult = {
  /** The view tabs as a `PageBar` (or `Section`) `tabs` slot. */
  tabs: ControlsSlot
  /** `PageBar search`: the table's quick search, written to its request after the search debounce. */
  search: PageSearch
  /** `PageBar controls`: `+ Filter`; empty (`count` 0) when no column filters. */
  controls: ControlsSlot
  /** The chip of each active filter: place it under the bar; it renders nothing while none is active. */
  chips: ReactElement
  /** `PageBar settings`: Edit view, which opens the panel. */
  settings: PageSettings
  /** `PageBar layout`: the view's layout toggle; absent when the table offers one layout. */
  layout: PageLayout<string> | undefined
  /** The manage-view panel; mount it once on the page, it renders nothing while closed. */
  panel: ReactElement
}

/**
 * Saved views as the view row of a page: tabs that apply a view, a per-tab menu, `+ View`, Save and
 * Discard for a modified view, and the manage-view panel that edits everything the view owns (name,
 * sharing, row height, column widths, columns, filters, sort, grouping) while the table follows.
 *
 * It also binds the table's own search and filter to the bar, so a list page draws one view row (tabs,
 * search, filter, layout, Edit view, the primary) and no `TableToolbar`.
 *
 * @useWhen a list page puts a table's saved views, search and filter in its `PageBar` view row
 * @neverWhen the table sits in a card with its own toolbar (`TableToolbar` draws the same views)
 *
 * @example
 * const t = useDataTable({ id: 'invoices', label: 'Invoices', columns, data, getRowId, mode: { kind: 'client' } })
 * const views = useTableViews(t)
 * <Page area="invoices" fill>
 *   <PageBar tabs={views.tabs} search={views.search} controls={views.controls} layout={views.layout} settings={views.settings} />
 *   {views.chips}
 *   <DataTable table={t} />
 *   {views.panel}
 * </Page>
 */
export function useTableViews<T>(
  instance: DataTableInstance<T>,
  options: TableViewsOptions = {},
): TableViewsResult {
  const model = modelOf(instance)
  const c = useViewsController(model, options)
  const t = useMessages(table)
  const layouts = useLayoutOptions(model)
  const layoutLabel = useLayoutLabel()
  const searchLabel = useSearchLabel(model.label)
  const q = model.state.request.q
  const written = useRef(q)
  const write = useDebouncedCallback((next: string) => {
    written.current = next
    model.state.setRequest({ q: next })
  }, SEARCH_DEBOUNCE_MS)
  // A `q` this box did not write (a view applied, a reset, a link) drops the phrase still waiting.
  useEffect(() => {
    if (q === written.current) return
    write.cancel()
    written.current = q
  }, [q, write])
  const searchHandle: ControlHandle<string> = {
    key: `${model.id}.q`,
    kind: 'string',
    use: () => [q, (next) => write.call(next)],
    useSource: () => ({ source: 'own', inherited: undefined }),
    clear() {
      write.cancel()
      written.current = ''
      model.state.setRequest({ q: '' })
    },
    isDefault: q === '',
  }
  return {
    search: { state: searchHandle, label: searchLabel.name, placeholder: searchLabel.placeholder },
    controls: {
      kind: 'controls-slot',
      count: filterableSpecs(model.specs).length > 0 ? 1 : 0,
      render: () => <AddFilter model={model} />,
    },
    chips: <ChipList model={model} />,
    tabs: { kind: 'controls-slot', count: 1, render: () => <ViewStrip c={c} /> },
    settings: { label: t('table.viewEdit'), onClick: () => c.show('root') },
    layout:
      layouts.length < 2
        ? undefined
        : {
            state: layoutHandle(model),
            label: layoutLabel,
            options: layouts.map(({ value, label, icon }) => ({ value, label, icon })),
          },
    panel: <Panel c={c} />,
  }
}

function EditGlyph(): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className="size-icon" fill="none" aria-hidden="true">
      <path
        d="M2.5 4.5h7M12.5 4.5h1M2.5 11.5h1M6.5 11.5h7M11 3v3M5 10v3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** The strip, an Edit view button and the panel in one place: what `TableToolbar` draws. */
export function ViewsBar<T>({
  model,
  view,
  onExport,
}: {
  model: TableModel<T>
  view?: ViewParam | undefined
  onExport?: (() => void) | undefined
}): ReactElement {
  const t = useMessages(table)
  const c = useViewsController(model, {
    ...(view !== undefined && { view }),
    ...(onExport !== undefined && { onExport }),
  })
  return (
    <div data-slot="table-views" className="@container flex min-w-0 items-center gap-2">
      <div className="flex min-w-0 flex-1">
        <ViewStrip c={c} />
      </div>
      <LayoutToggle model={model} />
      <Button
        variant="ghost"
        size="sm"
        shape="icon"
        aria-label={t('table.viewEdit')}
        onClick={() => c.show('root')}
      >
        <EditGlyph />
      </Button>
      <Panel c={c} />
    </div>
  )
}

/**
 * The saved views of a table in a bespoke toolbar: the tabs, Edit view and the panel. `view` binds
 * the applied id to the route's own search; omitted, it is `?view=` on the address bar.
 *
 * @useWhen a bespoke toolbar offers personal saved views of the table itself
 * @neverWhen `TableToolbar` fits (it already renders the views), or the views belong in `PageBar` (`useTableViews`)
 *
 * @example
 * <TableViews table={t} />
 */
export function TableViews<T>({
  table: instance,
  view,
}: {
  table: DataTableInstance<T>
  view?: ViewParam
}): ReactElement {
  return <ViewsBar model={modelOf(instance)} view={view} />
}
