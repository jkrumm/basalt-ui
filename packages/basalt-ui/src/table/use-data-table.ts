/**
 * `useDataTable`: the one hook that turns a column list, rows and a mode into the instance the
 * parts render (docs/v3/concepts/data-table.md sections 1 and 4). It owns the engine, the state
 * handle, the selection, the plan, the resolved phase and the row keyboard; the parts only draw.
 *
 * The instance is opaque to callers (`DataTableInstance`); the parts read the model behind it with
 * `modelOf`. Columns are plain per-render values: nothing here depends on their identity.
 */
import { createElement, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useFormat } from '../core/format'
import { useIntl } from '../core/provider-props'
import type { Format } from '../core/format'
import { useMessages } from '../core/messages/use-messages'
import { table } from '../core/messages/table'
import { resolvePhase } from '../core/phase'
import type { Empty, ResolvedPhase } from '../core/phase'
import type { Box, DetailHost } from '../core/ports'
import { clearTogether } from '../core/write-batch'
import { isActive } from '../controls/filter-set-census'
import type { AnySpec } from '../controls/filter-set-census'
import type {
  BulkAction,
  DataTableInstance,
  KindColumn,
  PageFilter,
  TableEscape,
  TableRequest,
  Totals,
  UseDataTable,
  ViewStore,
} from './contract'
import { AutoDetail, detailTitle } from './parts/auto-detail'
import { bodyItems, toggled } from './parts/group-row-model'
import type { BodyItem } from './parts/group-row-model'
import { tableEngine } from './core/features'
import { constructFilterFn, toColumnFilters } from './core/filters'
import type { RangeDomain } from './core/filters'
import { useRowKeyboard } from './core/keyboard'
import type { RowKeyboard } from './core/keyboard'
import { engineColumn } from './core/kinds-engine'
import { specOf } from './core/kinds-spec'
import type { KindSpec } from './core/kinds-spec'
import { planTable } from './core/plan'
import type { TablePlan } from './core/plan'
import { useSelection } from './core/selection'
import type { SelectionApi } from './core/selection'
import { countOf, useTableState } from './core/state'
import type { TableStateApi } from './core/state'

const MODEL: unique symbol = Symbol.for('basalt-ui.table.model')

const NO_ROWS: readonly never[] = []

/** A page row: the id a tick follows and the value the kinds draw. */
export type ModelRow<T> = { id: string; original: T }

export type Activation<T> =
  | { kind: 'row'; run: (row: T) => void }
  | { kind: 'detail'; render: (row: T, box: Box) => ReactNode }
  /** Neither `detail` nor `onRowActivate`: the row opens the sheet derived from its columns. */
  | { kind: 'auto' }

export type SortDirection = 'asc' | 'desc' | 'none'

/** Everything the parts read of a table; built by `useDataTable`, never by a caller. */
export type TableModel<T> = {
  id: string
  label: string
  specs: readonly KindSpec<T>[]
  plan: TablePlan
  rows: readonly ModelRow<T>[]
  /** What the body draws in order: the rows, or group rows with the rows of open groups. */
  items: readonly BodyItem<T>[]
  /** The declared grouping (client mode only); `summary` is the group row's box slot. */
  group: { spec: KindSpec<T>; summary?: (rows: readonly T[], box: Box) => ReactNode } | undefined
  toggleGroup(value: string): void
  server: boolean
  /** Client: every row matching the request (all pages), what the footer reduces. */
  matched: readonly T[]
  /** Server: the footer values the server computed for this request. */
  totals: Totals | undefined
  phase: ResolvedPhase
  /** Skeleton rows of a loading table: the rows it last showed, its planned page or `bodyRows`, else the default of `phases.tsx`. */
  skeletonRows: number | undefined
  /** Rows matching the request, `undefined` while unknown. */
  count: number | undefined
  pager: 'pages' | 'more' | 'none'
  /** What a narrow table becomes (default `cards`) and the width it does so below. */
  phone: 'cards' | 'scroll'
  cardsBelow: 'regular' | 'wide' | 'always'
  /** Present on a cursor table: the pager's `Load more` reads it. */
  cursor: { hasNext: boolean; fetchNext(): void } | undefined
  state: TableStateApi
  selection: SelectionApi<T> | undefined
  /** The bulk bar's inputs: the declared actions, the all-matching opt-in and the loaded rows. */
  bulk: { actions: readonly BulkAction<T>[]; selectAll: boolean; data: readonly T[] } | undefined
  activation: Activation<T>
  keyboard: RowKeyboard
  /** Identity of a row, for the link to a chart's focus items. */
  getRowId: (row: T) => string
  /** A `ViewStore` the caller supplied; absent, the Views panel keeps the views on the device. */
  viewStore: ViewStore | undefined
  /**
   * The parts hand the detail host here; an activation shows into the latest one. `kind` names where
   * the host comes from (the caller's, the page's, the table's own sheet): a host of another kind
   * replaces the one the entry was shown in, so the entry is hidden there and shown again here.
   */
  setHost(host: DetailHost | undefined, kind: string): void
  /** Opens the sheet derived from the row's columns (the `table-expand` door). */
  openDetails(id: string): void
  /**
   * The own sheet closed: unsets the `detailState` field, when one is bound; a push field leaves the
   * close as its own history entry, so Back returns to the open record. `hostClosed` is a host that
   * closed on its own: it does the same once a row has shown in it.
   */
  closeDetail(hostClosed?: boolean): void
  /** The row whose detail is open (`detail`) or that the page named (`activeRowId`); the body marks it. */
  activeId: string | undefined
  /**
   * Whether each row carries the `table-expand` door: `onRowActivate` takes the tap, and a tier can
   * hide a column (priority 3, or a card `detail`), so the derived sheet needs its own way in.
   */
  expandable: boolean
  /**
   * Whether a column placed in the card's `detail` stays reachable off the phone card: the derived
   * sheet lists it (`auto`, or `expandable` rows), where a custom `detail` render lists only what it writes.
   */
  detailListed: boolean
  format: Format
  /** One clock value per render so server and client agree on a relative time. */
  now: number
  sortOf(id: string): SortDirection
  toggleSort(id: string): void
  /** What a `range` filter on this column compares (days in the table's zone, or numbers). */
  domainOf(id: string): RangeDomain
  /**
   * How many rows hold each value of a column, given the search and every other filter: the
   * engine's facets on a client table, `mode.facets` on a server one, `undefined` when unknown.
   */
  facetsOf(id: string): ReadonlyMap<string, number> | undefined
  /** A ranked column's categories in the order the user gave them, else as declared. */
  rankOf(id: string): readonly string[]
  /**
   * Ranks a column's categories and sorts by them, ascending. The declared order drops the rank,
   * so the URL and a saved view carry one only while it differs.
   */
  setRank(id: string, order: readonly string[]): void
}

type Built<T> = DataTableInstance<T> & { readonly [MODEL]: TableModel<T> }

/** Reads the model behind an instance; an object not made by `useDataTable` throws. */
export function modelOf<T>(instance: DataTableInstance<T>): TableModel<T> {
  const model = (instance as Partial<Built<T>>)[MODEL]
  if (model === undefined) {
    throw new Error('basalt-ui/table: `table` was not made by useDataTable()')
  }
  return model
}

const MINUTE = 60_000

/**
 * Stands in for an absent `detailState`, so `use()` is called on every render either way; the table
 * then remembers the row it opened in component state.
 */
const NO_DETAIL_STATE = {
  // oxlint-disable-next-line react/hook-use-state -- hands back the pair as the field handle's `use` does
  use: (): [string, (id: string) => void] => useState(''),
}

/**
 * The page fields a table filters by (`filters`): reads each field (so the table follows it), and
 * judges "off its default" as a `FilterSet` does. The list must keep its length across renders, as
 * any list of hooks.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- entries of different value types share one list; `UseDataTable` types each pair
function usePageFilters<T>(filters: readonly PageFilter<T, any>[] = []) {
  // oxlint-disable-next-line react/rules-of-hooks -- one `use()` per entry, the list is fixed for the table's life
  const values = filters.map((filter) => filter.field.use()[0])
  const live = filters.flatMap((filter, i) =>
    isActive({ handle: filter.field } as unknown as AnySpec, values[i])
      ? [{ filter, value: values[i] }]
      : [],
  )
  return {
    active: live.length > 0,
    keep: (rows: readonly T[]) =>
      live.length === 0
        ? rows
        : rows.filter((row) => live.every(({ filter, value }) => filter.match(row, value))),
    clear: () => clearTogether(filters.map((filter) => filter.field)),
  }
}

/** What a column's `range` compares: calendar days in the table's zone on a date kind, else numbers. */
function domainOf(spec: Pick<KindSpec<never>, 'kind'>, zone: string | undefined): RangeDomain {
  return spec.kind === 'date' || spec.kind === 'relativeTime'
    ? { kind: 'day', zone }
    : { kind: 'number' }
}

function filterFnOf(spec: KindSpec<never>, zone: string | undefined) {
  return spec.filter === null
    ? {}
    : { filterFn: constructFilterFn(spec.filter, domainOf(spec, zone)) }
}

/**
 * A ranked column's categories in order: the user's rank first (values the column still declares),
 * then the declared options it does not name, in their declared order.
 */
export function rankedOptions(
  options: readonly string[],
  rank: readonly string[] | undefined,
): readonly string[] {
  if (rank === undefined || rank.length === 0) return options
  const declared = new Set(options)
  const named = rank.filter((value) => declared.has(value))
  const seen = new Set(named)
  return [...named, ...options.filter((value) => !seen.has(value))]
}

const rankSorts = new Map<string, (a: Row, b: Row, id: string) => number>()
type Row = { getValue(id: string): unknown }
type TableRequestRanks = TableRequest['ranks']

/** The engine sort of a column the user ranked; one function per order, so its identity holds. */
function rankSortOf(spec: KindSpec<never>, ranks: TableRequestRanks) {
  const rank = ranks?.[spec.id]
  if (spec.sort === null || spec.options === undefined || rank === undefined || rank.length === 0) {
    return {}
  }
  const order = rankedOptions(spec.options, rank)
  const key = JSON.stringify(order)
  let sortFn = rankSorts.get(key)
  if (sortFn === undefined) {
    const at = new Map(order.map((value, index) => [value, index]))
    const place = (value: unknown): number => at.get(String(value)) ?? order.length
    sortFn = (a, b, id) => place(a.getValue(id)) - place(b.getValue(id))
    rankSorts.set(key, sortFn)
  }
  return { sortFn }
}

/** The zone a date range compares days in: the provider's, `'host'` the runtime's, else UTC. */
function zoneOf(timeZone: string | undefined): string | undefined {
  return timeZone === 'host' ? undefined : (timeZone ?? 'UTC')
}

/**
 * The skeleton rows of a table that has shown none: the rows of the page it will show (its page
 * size, less what the known count leaves for the page), so loading is as tall as loaded. Unknown,
 * the page's declared `bodyRows` (capped at a page) comes before the page size; an unpaged table
 * without either keeps the default.
 */
function plannedRows(
  paged: boolean,
  request: { page: number; pageSize: number },
  count: number | undefined,
  declared?: number,
): number | undefined {
  const stated =
    declared !== undefined && Number.isInteger(declared) && declared >= 1
      ? Math.min(declared, paged ? request.pageSize : declared)
      : undefined
  if (!paged) return stated
  if (count === undefined) return stated ?? request.pageSize
  return Math.max(1, Math.min(request.pageSize, count - (request.page - 1) * request.pageSize))
}

/**
 * The table's state, engine, selection and phase in one call. Hand the result to `DataTable` or
 * to the parts. A narrow table becomes cards: `phone` defaults to `'cards'` (`'scroll'` pins the
 * name and scrolls sideways) and `cardsBelow` to `'regular'` (480 px of the table's own width, 800 px
 * when its priority 1 and 2 columns need more; `'wide'` is always 800, `'always'` never shows a
 * table). The tiers live in `basalt-ui/table.css`, which `basalt()` imports for any module that imports
 * `basalt-ui/table`; an app without the plugin imports it beside `basalt-ui/table`.
 *
 * @useWhen a page shows rows with sort, filter, paging or selection as a v3 table
 * @neverWhen the rows are static with no behaviour (use `ui/table`)
 *
 * @example
 * const c = col<Order>()
 * const t = useDataTable({
 *   id: 'orders',
 *   label: 'Orders',
 *   columns: [c.entity('customer'), c.money('total', { currency: 'EUR' })],
 *   data: query.data,
 *   phase: query,
 *   getRowId: (o) => o.id,
 *   mode: { kind: 'client' },
 * })
 */
export function useDataTable<
  T,
  // oxlint-disable-next-line typescript/no-explicit-any -- as `UseDataTable`'s default: an explicit `<Row>` call keeps the filter values loose
  const F extends readonly unknown[] = readonly any[],
>(options: UseDataTable<T, F>): DataTableInstance<T> {
  const { mode, getRowId, columns } = options
  const t = useMessages(table)
  const format = useFormat()
  const zone = zoneOf(useIntl().timeZone)
  const server = mode.kind === 'server'
  const pager = options.pager ?? (!server ? 'none' : 'cursor' in mode ? 'more' : 'pages')
  const paged = pager !== 'none' && !(server && 'cursor' in mode)

  // A fixed clock wins; otherwise the minute, floored so server and client agree, ticking once a minute.
  const [minute, setMinute] = useState(() => Math.floor(Date.now() / MINUTE))
  useEffect(() => {
    if (options.now !== undefined) return
    const id = setInterval(() => setMinute(Math.floor(Date.now() / MINUTE)), MINUTE)
    return () => clearInterval(id)
  }, [options.now])
  const now = options.now ?? minute * MINUTE
  const specs = columns.map((column: KindColumn<T>) => specOf(column))
  const known = new Set(specs.map((spec) => spec.id))

  const clearRef = useRef<() => void>(() => undefined)
  const recheckRef = useRef<() => void>(() => undefined)
  const [clientCount, setClientCount] = useState<number | undefined>(undefined)
  const state = useTableState({
    id: options.id,
    handle: options.state,
    count: server ? countOf(mode) : clientCount,
    paged,
    resetOn: options.resetOn,
    onReset: () => {
      clearRef.current()
      recheckRef.current()
    },
  })
  const { request, display } = state

  const selection = useSelection<T>({ getRowId, request })
  useEffect(() => {
    clearRef.current = selection.clear
  })

  const visibilityKey = JSON.stringify(display.visibility)
  const shapeKey = specs
    .map(
      (s) =>
        `${s.id}:${s.kind}:${s.priority}:${JSON.stringify(s.width)}:${s.pin}:${s.card.join('/')}`,
    )
    .join('|')
  const contentCh = contentWidths(specs, options.data)
  const plan = usePlan(
    columns,
    shapeKey + visibilityKey + JSON.stringify(contentCh),
    display.visibility,
    contentCh,
  )

  const pageFilters = usePageFilters<T>(server ? undefined : options.filters)
  const data = pageFilters.keep((options.data ?? NO_ROWS) as T[])
  const engine = tableEngine.useAppTable({
    columns: specs.map((spec) => ({
      ...engineColumn(spec as KindSpec<unknown>),
      ...filterFnOf(spec as KindSpec<never>, zone),
      ...rankSortOf(spec as KindSpec<never>, request.ranks),
    })) as never,
    data,
    getRowId,
    state: {
      sorting: request.sort,
      columnFilters: toColumnFilters(request.filters, known),
      globalFilter: request.q,
      pagination: { pageIndex: Math.max(0, request.page - 1), pageSize: request.pageSize },
    },
    manualSorting: server,
    manualFiltering: server,
    manualPagination: server || !paged,
    ...(server && 'rowCount' in mode && mode.rowCount !== undefined
      ? { rowCount: mode.rowCount }
      : {}),
  } as never)

  const rows: ModelRow<T>[] = engine
    .getRowModel()
    .rows.map((row: { id: string; original: unknown }) => ({
      id: row.id,
      original: row.original as T,
    }))
  const matched: readonly T[] = server
    ? rows.map((row) => row.original)
    : (engine.getPrePaginatedRowModel() as { rows: { original: unknown }[] }).rows.map(
        (row) => row.original as T,
      )
  const matching = server ? undefined : matched.length
  if (!server && matching !== clientCount) setClientCount(matching)

  const [lastRows, setLastRows] = useState<number | undefined>(undefined)
  if (options.data !== undefined && rows.length > 0 && rows.length !== lastRows) {
    setLastRows(rows.length)
  }

  const group = groupOf(options.group, specs, server)
  const items = bodyItems(rows, group?.spec, display.collapsed, matched)

  const filtering = request.q !== '' || request.filters.length > 0 || pageFilters.active
  const settled = options.data !== undefined
  const pageFiltered = options.empty?.filtered
  const ownNarrowing = request.q !== '' || request.filters.length > 0
  // The page's own sentence stands when the page narrowed the rows; a phrase or column filter the
  // user set keeps the table's, which names the search only when one is set.
  const pageCause =
    pageFiltered || (pageFilters.active && !ownNarrowing) ? options.empty?.cause : undefined
  const empty: Empty | null =
    settled && rows.length === 0
      ? filtering
        ? {
            cause:
              pageCause ?? (request.q === '' ? t('table.noMatchesFilters') : t('table.noMatches')),
            filtered: {
              reset: () => {
                state.setRequest({ q: '', filters: [] })
                pageFilters.clear()
                pageFiltered?.reset()
              },
            },
          }
        : {
            cause: options.empty?.cause ?? t('table.empty'),
            ...(options.empty?.action && { action: options.empty.action }),
            ...(pageFiltered && { filtered: pageFiltered }),
          }
      : null
  const phase = resolvePhase({
    phase: options.phase ?? (settled ? undefined : 'loading'),
    empty,
  })

  const host = useRef<DetailHost | undefined>(undefined)
  const hostKind = useRef<string | null>(null)
  const byId = new Map(rows.map((row) => [row.id, row.original] as const))
  const activation: Activation<T> =
    options.detail !== undefined
      ? { kind: 'detail', render: options.detail }
      : options.detailById !== undefined
        ? { kind: 'detail', render: (row, box) => options.detailById?.(getRowId(row), box) }
        : options.onRowActivate !== undefined
          ? { kind: 'row', run: options.onRowActivate }
          : { kind: 'auto' }

  const showAuto = (id: string): void => {
    const row = byId.get(id)
    if (row === undefined) return
    host.current?.show({
      title: detailTitle(model, row),
      body: (box) => createElement(AutoDetail<T>, { model, row, box }),
    })
  }
  const showDetail = (row: T): void => {
    if (activation.kind !== 'detail') return
    const { render } = activation
    host.current?.show({
      title: options.detailTitle?.(row) ?? options.label,
      body: (box) => render(row, box),
    })
  }
  // The `detailState` field: the id of the open row. `NO_DETAIL_STATE` keeps the hook order fixed.
  const detailState = options.detailState
  const [openId, setOpenId] = (detailState ?? NO_DETAIL_STATE).use()
  const shownFor = useRef<string | null>(null)
  // Set when a `resetOn` change dropped the shown id for a re-check: the old entry is still up.
  const staleShown = useRef(false)
  useEffect(() => {
    // The rows reset: the open id is checked against the new ones, as a URL id is at load.
    recheckRef.current = () => {
      if (shownFor.current === null) return
      shownFor.current = null
      staleShown.current = true
    }
  })
  // A table that unmounts takes the record it showed with it (a pane that drops the table).
  useEffect(
    () => () => {
      if (shownFor.current === null && !staleShown.current) return
      host.current?.hide()
    },
    [],
  )
  const activate = (id: string): void => {
    const row = byId.get(id)
    if (row === undefined) return
    if (activation.kind === 'row') activation.run(row)
    else if (activation.kind === 'auto') showAuto(id)
    else if (activation.kind === 'detail') {
      if (detailState !== undefined) shownFor.current = id
      setOpenId(id)
      showDetail(row)
    }
  }
  // Shows the record a field names: its loaded row, else `detailById`'s body.
  const showField = (id: string): void => {
    const row = matched.find((r) => getRowId(r) === id)
    const { detailById } = options
    if (row !== undefined) showDetail(row)
    else if (detailById !== undefined)
      host.current?.show({
        title: options.detailTitleById?.(id) ?? options.label,
        body: (box) => detailById(id, box),
      })
  }
  // The field is the source of truth: a name that arrives from the URL opens its row once the rows
  // load, and a field that goes unset (Back, `clear()`) closes the sheet the table opened. A name no
  // loaded row has opens `detailById`'s body once the query settled, or is cleared with a dev warning.
  useEffect(() => {
    if (detailState === undefined) return
    if (!openId) {
      if (shownFor.current === null) return
      shownFor.current = null
      host.current?.hide()
      return
    }
    if (shownFor.current === openId) return
    // `matched` is every row the request matches (all pages of a client table), so a row off the
    // current page still opens its `detail`.
    const row = matched.find((r) => getRowId(r) === openId)
    const { detailById } = options
    if (row === undefined) {
      if (phase.tag !== 'ready' && phase.tag !== 'empty') return
      if (detailById === undefined) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console -- dev-only diagnostic
          console.warn(
            `basalt-ui/table: "${options.id}" detailState names "${openId}", no loaded row; cleared. Pass detailById to open it.`,
          )
        }
        if (staleShown.current) host.current?.hide()
        staleShown.current = false
        detailState.clear({ replace: true })
        return
      }
    }
    if (host.current === undefined) return
    staleShown.current = false
    shownFor.current = openId
    showField(openId)
  })
  const keyboard = useRowKeyboard({
    rowIds: items.flatMap((item) => (item.type === 'row' ? [item.row.id] : [])),
    onActivate: activate,
    onToggle: options.selection === undefined ? undefined : selection.toggle,
    onClear: options.selection === undefined ? undefined : selection.clear,
  })

  const model: TableModel<T> = {
    id: options.id,
    label: options.label,
    specs,
    plan,
    rows,
    items,
    group,
    toggleGroup(value) {
      state.setDisplay({ collapsed: toggled(display.collapsed, value) })
    },
    server,
    matched,
    totals: mode.kind === 'server' && 'totals' in mode ? mode.totals : undefined,
    phase,
    skeletonRows:
      lastRows ??
      plannedRows(
        paged,
        request,
        server ? countOf(mode) : settled ? matching : undefined,
        options.bodyRows,
      ),
    count: server ? countOf(mode) : matching,
    pager,
    phone: options.phone ?? 'cards',
    cardsBelow: options.cardsBelow ?? 'regular',
    cursor: server && 'cursor' in mode ? mode.cursor : undefined,
    state,
    selection: options.selection === undefined ? undefined : selection,
    bulk:
      options.selection === undefined
        ? undefined
        : {
            actions: options.selection.bulk,
            selectAll: options.selection.selectAll === true,
            data,
          },
    activation,
    keyboard,
    getRowId,
    viewStore: options.views?.store,
    setHost(next, kind) {
      const previous = host.current
      host.current = next
      if (hostKind.current !== kind) {
        hostKind.current = kind
        // The page's aside mounts after the table's first render, so a deep link can show in the
        // table's own sheet first; the entry moves to the host that took over. This runs from the
        // parts' effect, which a host change reaches while the table's own effect does not.
        const shown = shownFor.current
        if (previous !== undefined && next !== undefined && shown !== null) {
          previous.hide()
          showField(shown)
        }
      }
    },
    openDetails: showAuto,
    closeDetail(hostClosed) {
      // `shownFor` keeps the closed id until the field reads empty, so a render that lands before
      // the field clears cannot reopen the sheet the user just closed. A host that closed on its
      // own clears the field only once a row has shown in it (a deep link that has not shown yet
      // keeps its id); the call comes on every render of the body.
      if (!hostClosed || shownFor.current !== null) detailState?.clear()
      if (detailState === undefined && openId) setOpenId('')
    },
    activeId: activation.kind === 'detail' ? openId : options.activeRowId,
    expandable:
      activation.kind === 'row' &&
      plan.columns.some(
        (column) => column.visible && (column.priority === 3 || column.place === 'detail'),
      ),
    detailListed: activation.kind !== 'detail',
    format,
    now,
    sortOf(id) {
      const entry = request.sort.find((s) => s.id === id)
      return entry === undefined ? 'none' : entry.desc ? 'desc' : 'asc'
    },
    toggleSort(id) {
      const current = request.sort.find((s) => s.id === id)
      state.setRequest({
        sort:
          current === undefined ? [{ id, desc: false }] : current.desc ? [] : [{ id, desc: true }],
      })
    },
    domainOf(id) {
      return domainOf(specs.find((s) => s.id === id) ?? { kind: 'number' }, zone)
    },
    facetsOf(id) {
      if (server) {
        const listed = 'facets' in mode ? mode.facets?.[id] : undefined
        return listed === undefined ? undefined : new Map(listed.map((f) => [f.value, f.count]))
      }
      const column = (
        engine as unknown as {
          getColumn(id: string): { getFacetedUniqueValues(): Map<unknown, number> } | undefined
        }
      ).getColumn(id)
      if (column === undefined) return undefined
      const counts = new Map<string, number>()
      for (const [value, count] of column.getFacetedUniqueValues()) {
        if (value === undefined || value === null) continue
        const key = String(value)
        counts.set(key, (counts.get(key) ?? 0) + count)
      }
      return counts
    },
    rankOf(id) {
      const spec = specs.find((s) => s.id === id)
      return rankedOptions(spec?.options ?? [], request.ranks?.[id])
    },
    setRank(id, order) {
      const declared = specs.find((s) => s.id === id)?.options ?? []
      const { [id]: _previous, ...others } = request.ranks ?? {}
      const same = order.length === declared.length && order.every((v, i) => v === declared[i])
      state.setRequest({
        ranks: same ? others : { ...others, [id]: [...order] },
        sort: [{ id, desc: false }],
      })
    },
  }
  const escape: TableEscape<T> = {
    rows,
    matched,
    columns: plan.columns.flatMap((planned, index) => {
      const spec = specs[index]
      return planned.visible && spec !== undefined && spec.kind !== 'actions'
        ? [{ id: spec.id, header: spec.header, value: spec.value }]
        : []
    }),
  }
  return { __brand: 'DataTableInstance', table: escape, [MODEL]: model } as Built<T>
}

/**
 * The declared grouping resolved against the columns. A server table never groups (the type
 * already refuses it; grouping needs every row); an unknown column throws naming it.
 */
function groupOf<T>(
  group: UseDataTable<T>['group'],
  specs: readonly KindSpec<T>[],
  server: boolean,
): TableModel<T>['group'] {
  if (group === undefined || server) return undefined
  const spec = specs.find((s) => s.id === group.by)
  if (spec === undefined) {
    throw new Error(
      `basalt-ui/table: group.by "${group.by}" is not a column; use one of ${specs.map((s) => s.id).join(', ')}`,
    )
  }
  return { spec, ...(group.summary !== undefined && { summary: group.summary }) }
}

/** Rows read when sizing a `width: 'content'` column; a longer list is sampled from its head. */
const CONTENT_SAMPLE = 1000

/** The widest loaded value in `ch` of each `width: 'content'` column, by id; `{}` when none. */
function contentWidths<T>(
  specs: readonly KindSpec<T>[],
  data: readonly T[] | undefined,
): Record<string, number> {
  const widths: Record<string, number> = {}
  if (data === undefined) return widths
  for (const spec of specs) {
    if (spec.content === undefined) continue
    let widest = 0
    for (const row of data.slice(0, CONTENT_SAMPLE))
      widest = Math.max(widest, spec.content.measure(row))
    widths[spec.id] = widest
  }
  return widths
}

/** The plan, recomputed only when a column's shape, the visibility or a content width changes (one dev warning each). */
function usePlan<T>(
  columns: readonly KindColumn<T>[],
  key: string,
  visibility: Record<string, boolean>,
  contentCh: Record<string, number>,
): TablePlan {
  // oxlint-disable-next-line react/exhaustive-deps -- `key` IS the shape of `columns`, `visibility` and `contentCh`
  return useMemo(() => planTable(columns, { visibility, contentCh }), [key])
}
