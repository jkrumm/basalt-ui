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
import type { Box, DetailHost, RecordSequence } from '../core/ports'
import { resolveLayouts } from './layouts/specs'
import type { LayoutEntry } from './layouts/specs'
import { clearTogether } from '../core/write-batch'
import { isActive } from '../controls/filter-set-census'
import type { AnySpec } from '../controls/filter-set-census'
import type {
  Aggregate,
  BulkAction,
  DataTableInstance,
  KindColumn,
  PageFilter,
  RowAction,
  RowHeight,
  TableDisplay,
  TableEscape,
  BuiltinLayout,
  TableLayoutSpec,
  TableRequest,
  Totals,
  UseDataTable,
  ViewStore,
} from './contract'
import { AutoDetail, detailTitle } from './parts/auto-detail'
import { bodyItems, toggled } from './parts/group-row-model'
import { treeItems } from './parts/tree-row-model'
import type { TreeInfo } from './parts/tree-row-model'
import type { BodyItem } from './parts/group-row-model'
import { tableEngine } from './core/features'
import { constructFilterFn, dayOf, toColumnFilters } from './core/filters'
import type { FilterFn, RangeDomain } from './core/filters'
import { arrangeColumns, moveColumn } from './core/arrange'
import type { ArrangedColumn } from './core/arrange'
import { useRowKeyboard } from './core/keyboard'
import type { RowKeyboard } from './core/keyboard'
import { engineColumn } from './core/kinds-engine'
import { KIND_DEFAULTS, isDayKind, specOf } from './core/kinds-spec'
import type { KindSpec } from './core/kinds-spec'
import {
  clampWidth,
  isResizable,
  minWidthPx,
  planTable,
  RESIZE_MAX_PX as RESIZE_MAX,
  rowNumberPx,
  TICK_COL_PX,
} from './core/plan'
import type { TablePlan } from './core/plan'
import { useSelection } from './core/selection'
import type { SelectionApi } from './core/selection'
import { countOf, useTableState } from './core/state'
import { aggregateOf, aggregatesOf } from './parts/footer-model'
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
  /** The row ids in the order the body draws them: what a detail host steps through. */
  rowIds: readonly string[]
  /** The columns in drawn order: the identity column, the reader's order (pins first), `actions`. */
  specs: readonly KindSpec<T>[]
  /** The plan in the same drawn order; a start-pinned column carries its offset as `pinAt`. */
  plan: Omit<TablePlan, 'columns'> & { columns: readonly ArrangedColumn[] }
  /** The ids a reader can move, in drawn order: every column but the identity column and `actions`. */
  movable: readonly string[]
  /** Moves a column to index `to` of `movable`; written to `display.order`. */
  moveColumn(id: string, to: number): void
  /** Whether the reader pinned the column (a grid look draws it pinned). */
  pinnedOf(id: string): boolean
  /** Pins or unpins a column, written to `display.pinned`. */
  setPinned(id: string, pinned: boolean): void
  /** The leading columns before the first kind column: the tick and the row number, their count and px. */
  lead: { tick: boolean; numbers: boolean; cols: number; numberPx: number; px: number }
  /** The row's number (`rowNumbers`): its place in the request, running on across groups and pages. */
  numberOf(id: string): number | undefined
  /** Whether a reader may drag the column's edge (every column but `actions`). */
  resizable(id: string): boolean
  /** The column's drawn width in px and its bounds. */
  widthOf(id: string): { px: number; min: number; max: number }
  /** A drag in progress: the width shown until `setWidth` writes it; `null` ends the preview. */
  previewWidth(id: string, px: number | null): void
  /** Writes a column's width to `display.widths`; `undefined` resets it to the kind's width. */
  setWidth(id: string, px: number | undefined): void
  /** Drops every width a reader set. */
  resetWidths(): void
  /** The body's row height: the view's, else the declared `rowHeight`; `undefined` is the app's density. */
  rowHeight: RowHeight | undefined
  /** Writes the view's row height; `undefined` returns to the declared one. */
  setRowHeight(height: RowHeight | undefined): void
  /** The column the rows are grouped by, `null` for none (a server table never groups). */
  groupBy: string | null
  /** Whether the rows may be grouped by the column (client mode, a kind that groups). */
  groupable(id: string): boolean
  /** Writes the view's grouping: a column id, `null` for none, `undefined` for the declared `group`. */
  setGroupBy(id: string | null | undefined): void
  /** The reduce the column's footer and group rows print, `undefined` for none. */
  aggregateOf(id: string): Aggregate | undefined
  /** The reduces a reader may pick for the column (none on a server table). */
  aggregatesOf(id: string): readonly Aggregate[]
  /** Writes the view's reduce for a column: `'none'` drops it, `undefined` returns to the declared one. */
  setAggregate(id: string, fn: Aggregate | 'none' | undefined): void
  /** The layouts a reader may pick, in toggle order: `layouts` without the ones this table cannot draw. */
  layouts: readonly LayoutEntry<T>[]
  /** The id of the view's layout: its pick while the table offers it, else `table`. */
  layout: string
  /** Writes the view's layout id; `table` drops the key. */
  setLayout(layout: string): void
  /** The `select` columns a board may stand on (client mode), in drawn order. */
  boardAxes: readonly string[]
  /** Activates a row as a click or Enter on it does: its `onRowActivate`, `detail` or derived sheet. */
  activate(id: string): void
  rows: readonly ModelRow<T>[]
  /** What the body draws in order: the rows, or group rows with the rows of open groups. */
  items: readonly BodyItem<T>[]
  /** The declared grouping (client mode only); `summary` is the group row's box slot. */
  group: { spec: KindSpec<T>; summary?: (rows: readonly T[], box: Box) => ReactNode } | undefined
  toggleGroup(value: string): void
  /** Nested rows (`nested`, client mode): the items carry their `tree` place and the table is a tree grid. */
  nested: boolean
  /** Opens or closes a nested row. */
  toggleRow(id: string): void
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
  /** How the table draws its rules; `grid` keeps every column and scrolls sideways. */
  look: 'reading' | 'grid'
  /** The actions of the row menu, also opened by a right click, a long press and Shift+F10; `undefined` without an actions column or with `contextMenu: false`. */
  rowMenu: readonly RowAction<T>[] | undefined
  /** Whether the headers draw their column icons (`headerIcons`: on in the grid look, off in the reading look). */
  headerIcons: boolean
  /** What a narrow table becomes (default `cards`, `scroll` for a grid) and the width it does so below. */
  phone: 'cards' | 'fields' | 'scroll' | 'columns'
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
  /** A `ViewStore` the caller supplied; absent, the view tabs keep the views on the device. */
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
  /** The zone a `countdown` counts days in: the provider's, `'host'` the runtime's. */
  zone?: string
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

let layoutWarned = false

/**
 * The layouts a table offers: the caller's, `table` when none, without `board` where it cannot stand
 * (a server table never groups; a board's drop is a `select` column's `commit`). A dev warning
 * names a dropped board once per page.
 */
function offeredLayouts<T>(
  id: string,
  asked: readonly (BuiltinLayout | TableLayoutSpec<T>)[] | undefined,
  server: boolean,
  hasAxis: boolean,
): readonly (BuiltinLayout | TableLayoutSpec<T>)[] {
  const wanted = asked === undefined || asked.length === 0 ? DEFAULT_LAYOUTS : asked
  if (!wanted.includes('board') || (!server && hasAxis)) return wanted
  if (process.env.NODE_ENV !== 'production' && !layoutWarned) {
    layoutWarned = true
    // oxlint-disable-next-line no-console -- a development warning for a layout the table cannot draw
    console.warn(
      `basalt-ui/table: "${id}" offers the board layout, but ${server ? 'a server table never groups its rows' : 'it has no c.select column whose commit a drop could call'}; the board was left out.`,
    )
  }
  return wanted.filter((layout) => layout !== 'board')
}

const DEFAULT_LAYOUTS: readonly BuiltinLayout[] = ['table']

const unknownWarned = new Set<string>()

/**
 * The id the view draws: its saved pick while the table offers it, else `table`. A pick the table
 * does not offer (a saved view naming a layout the app since dropped) is named once per table in dev.
 */
function shownLayout<T>(
  table: string,
  saved: string | undefined,
  layouts: readonly LayoutEntry<T>[],
): string {
  if (saved === undefined || layouts.some((layout) => layout.id === saved)) return saved ?? 'table'
  if (process.env.NODE_ENV !== 'production' && !unknownWarned.has(`${table}:${saved}`)) {
    unknownWarned.add(`${table}:${saved}`)
    // oxlint-disable-next-line no-console -- a development warning for a saved layout the table does not offer
    console.warn(
      `basalt-ui/table: "${table}" has a view saved in the layout "${saved}", which it does not offer; the view draws as a table.`,
    )
  }
  return 'table'
}

/** What a column's `range` compares: calendar days in the table's zone on a date kind, else numbers. */
function domainOf(spec: Pick<KindSpec<never>, 'kind'>, zone: string | undefined): RangeDomain {
  return isDayKind(spec.kind) ? { kind: 'day', zone } : { kind: 'number' }
}

/**
 * The search over every column (client mode): a row matches when any column's search text (what
 * its cell shows and the stored value) contains the phrase, case-insensitive.
 */
function searchFnOf<T>(specs: readonly KindSpec<T>[], format: Format, now: number) {
  const byId = new Map(specs.map((spec) => [spec.id, spec]))
  return (row: { original: T }, columnId: string, phrase: unknown): boolean => {
    const needle = String(phrase).trim().toLocaleLowerCase()
    if (needle === '') return true
    const text = byId.get(columnId)?.search?.(row.original, format, now)
    return text !== undefined && text.toLocaleLowerCase().includes(needle)
  }
}

function filterFnOf(spec: KindSpec<never>, zone: string | undefined) {
  if (spec.filter === null) return {}
  const base = constructFilterFn(spec.filter, domainOf(spec, zone))
  const text = spec.filterText
  if (text === undefined) return { filterFn: base }
  // A `custom` column's text filter matches its `search` text; the accessor keeps the sort value,
  // so an absent one still sorts last.
  const filterFn = ((
    row: { original: never; getValue(id: string): unknown },
    id: string,
    value: unknown,
  ) =>
    base(
      { ...row, getValue: () => text(row.original) } as never,
      id,
      value as never,
    )) as unknown as FilterFn
  filterFn.autoRemove = base.autoRemove
  return { filterFn }
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

/** Drops a folded column's derived hide from a display write, so only a reader's own choice is stored. */
function withoutFold(patch: Partial<TableDisplay>, id: string): Partial<TableDisplay> {
  if (patch.visibility?.[id] !== false) return patch
  const visibility = Object.fromEntries(
    Object.entries(patch.visibility).filter(([key]) => key !== id),
  )
  return { ...patch, visibility }
}

/**
 * The table's state, engine, selection and phase in one call. Hand the result to `DataTable` or
 * to the parts. A narrow table becomes cards: `phone` defaults to `'cards'` (a list row: the title, up to
 * two muted meta values, the answering value at the right edge, the rest behind a tap; `'fields'` is the
 * label-and-value grid; `'scroll'` pins the name and scrolls sideways; `'columns'` keeps a table of the name, the card's `value` and its first
 * `meta`, the rest in the row's details) and `cardsBelow` to `'regular'` (480 px of the table's own width, 700 or
 * 800 px when its priority 1 and 2 columns need more; `'wide'` is always 800, `'always'` never shows a
 * table). The tiers live in `basalt-ui/table.css`, which `basalt()` imports for any module that imports
 * `basalt-ui/table`; an app without the plugin imports it beside `basalt-ui/table`. The column plan's rules, and
 * what `shot detect` reports of a column it hides, are in `col`.
 *
 * How the table folds: a column's `priority` is decided against the table's container, not the
 * viewport, from widths the kit estimates and never measures, so plan the columns before the shot. A
 * column is `ch` x 8 px + 24 px wide (`CH_PX`, `CELL_PAD_PX`; an icon column 44 px; a flexible title
 * column counts its 18 ch minimum). Add the widths of the visible columns: priority 3 shows from the
 * smallest of 480, 520 ... 680, 700, 720 ... 800 (every 40 px, with 700 between 680 and 720), 900, 1000,
 * 1100, 1200, 1300, 1440, 1600 or 1800 px that holds that sum, so five columns of 664 px keep all five in a 748 px cell (the step is 680 px); above
 * 1800 px of columns the table stays reduced. Priority 1 and 2 show as a table from 480 px, from 700 px
 * once their sum is above 480 px, or from 800 px once it is above 700; below that width the rows are
 * cards (`phone: 'cards'`, or `'fields'`), the table scrolls (`phone: 'scroll'`, the title pinned and the other
 * columns off screen at 390 px) or the table keeps three columns sized to their values
 * (`phone: 'columns'`, the name wrapping into what they leave). Only two priority 1 columns count: a third is a priority 2. While
 * priority 1 and 2 sum above 800 px the last priority 2 columns drop to 3 whatever the container. A
 * table in a half-width cell (about 750 px at 1800; 718 px of table inside a DataPanel's card edges) therefore
 * keeps its columns while a step at or under that width holds their sum: 700 px holds 696 px of columns,
 * where a 720 px step would fold them to cards; a value longer than its column's estimate wraps or is clipped to an
 * ellipsis, the column does not grow.
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
  const nestedRows = options.nested !== undefined && !server
  // A nested table shows every row: a page boundary would cut a row from the rows above it.
  const pager = nestedRows
    ? 'none'
    : (options.pager ?? (!server ? 'none' : 'cursor' in mode ? 'more' : 'pages'))
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

  const group = nestedRows ? undefined : groupOf(options.group, specs, server, display.groupBy)
  const groupSpec = group?.spec
  // A folded grouping draws its column in the group rows only, unless a reader showed or hid it.
  const folds =
    options.group?.fold === true &&
    groupSpec?.id === options.group.by &&
    display.visibility[groupSpec.id] === undefined
  const folded = folds ? groupSpec.id : undefined
  const visibility =
    folded === undefined ? display.visibility : { ...display.visibility, [folded]: false }
  const visibilityKey = JSON.stringify(visibility)
  const shapeKey = specs
    .map(
      (s) =>
        `${s.id}:${s.kind}:${s.priority}:${JSON.stringify(s.width)}:${s.pin}:${s.card.join('/')}`,
    )
    .join('|')
  const contentCh = contentWidths(specs, options.data)
  // A drag shows its width at once and writes the view once, on release.
  const [preview, setPreview] = useState<{ id: string; px: number } | null>(null)
  const widths =
    preview === null ? (display.widths ?? {}) : { ...display.widths, [preview.id]: preview.px }
  const plan = usePlan(
    columns,
    // A release re-plans even at the width last previewed, so its dev warnings run once.
    shapeKey +
      visibilityKey +
      JSON.stringify(contentCh) +
      JSON.stringify(widths) +
      (preview === null ? '' : '|preview') +
      (options.look ?? 'reading'),
    visibility,
    contentCh,
    widths,
    preview !== null,
    options.look ?? 'reading',
  )
  const look = options.look ?? 'reading'
  const phone = options.phone ?? (look === 'grid' ? 'scroll' : 'cards')
  const tick = options.selection !== undefined
  const numbers = options.rowNumbers === true
  // The number column fits the largest number it can print, as it prints it: every row of a client
  // table; the counted rows of a server one, else the rows it has loaded (a cursor table's Load more)
  // or reached by paging.
  const loaded = options.data?.length ?? 0
  const largest = server
    ? (countOf(mode) ?? Math.max(loaded, request.page * request.pageSize))
    : loaded
  const numberPx = numbers ? rowNumberPx(format.number(Math.max(1, largest))) : 0
  const lead = {
    tick,
    numbers,
    cols: (tick ? 1 : 0) + (numbers ? 1 : 0),
    numberPx,
    px: (tick ? TICK_COL_PX : 0) + numberPx,
  }
  const arranged = arrangeColumns(
    specs,
    plan,
    { order: display.order, pinned: look === 'grid' ? display.pinned : undefined },
    lead.px,
  )
  const pinnedIds = display.pinned ?? []

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
    globalFilterFn: searchFnOf(specs, format, now),
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

  // A date groups by its day in the table's zone, never by the instant.
  const groupKey =
    groupSpec !== undefined && isDayKind(groupSpec.kind)
      ? (row: T) => dayOf(groupSpec.value(row), zone) ?? ''
      : undefined
  const items =
    options.nested !== undefined && nestedRows
      ? treeItems({
          matched: rows,
          all: options.data ?? NO_ROWS,
          getRowId,
          parentOf: options.nested.parentOf,
          collapsed: display.collapsed,
          narrowed: request.q !== '' || request.filters.length > 0 || pageFilters.active,
        })
      : bodyItems(rows, groupSpec, display.collapsed, matched, groupKey)
  const treeOf = (id: string): TreeInfo | undefined => {
    const item = items.find((entry) => entry.type === 'row' && entry.row.id === id)
    return item?.type === 'row' ? item.tree : undefined
  }
  const setOpen = (id: string, open: boolean): boolean => {
    const tree = treeOf(id)
    if (tree === undefined || !tree.parent || tree.pinned || tree.open === open) return false
    state.setDisplay({ collapsed: toggled(display.collapsed, id) })
    return true
  }

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

  // The rows in the order the table draws them: a detail host steps through them in place.
  const rowOrder = items.flatMap((item) => (item.type === 'row' ? [item.row.id] : []))
  // A shown entry outlives the render that made it (the reader sorts or filters with the panel
  // open), so its records read the order and the step of the latest render.
  const live = useRef<{ order: readonly string[]; step: (id: string) => void }>({
    order: rowOrder,
    step: () => {},
  })
  const recordsAt = (id: string): RecordSequence | undefined =>
    rowOrder.includes(id)
      ? {
          get ids() {
            return live.current.order
          },
          id,
          onStep: (next) => live.current.step(next),
        }
      : undefined
  const showAuto = (id: string): void => {
    const row = byId.get(id)
    if (row === undefined) return
    const records = recordsAt(id)
    host.current?.show({
      title: detailTitle(model, row),
      body: (box) => createElement(AutoDetail<T>, { model, row, box }),
      ...(records !== undefined && { records }),
    })
  }
  const showDetail = (row: T): void => {
    if (activation.kind !== 'detail') return
    const { render } = activation
    const records = recordsAt(getRowId(row))
    host.current?.show({
      title: options.detailTitle?.(row) ?? options.label,
      body: (box) => render(row, box),
      ...(records !== undefined && { records }),
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
    rowIds: rowOrder,
    tree: nestedRows
      ? {
          open: (id) => setOpen(id, true),
          close: (id) => setOpen(id, false),
          parentOf: (id) => treeOf(id)?.parentId,
        }
      : undefined,
    onActivate: activate,
    onToggle: options.selection === undefined ? undefined : selection.toggle,
    onClear: options.selection === undefined ? undefined : selection.clear,
    // The grid look roves cells: the tick (on a selectable table) and every drawn column.
    cells:
      look === 'grid'
        ? lead.cols + arranged.plan.columns.filter((column) => column.visible).length
        : undefined,
    treeCell: lead.cols,
  })
  const numbersById = numbers
    ? rowNumbers(items, paged ? (request.page - 1) * request.pageSize : 0)
    : undefined
  const specById = new Map(specs.map((spec) => [spec.id, spec]))
  const plannedById = new Map(arranged.plan.columns.map((column) => [column.id, column]))
  const boardAxes = server
    ? []
    : arranged.specs.flatMap((spec) =>
        spec.kind === 'select' && spec.edit !== undefined ? [spec.id] : [],
      )
  const layouts = resolveLayouts(
    options.id,
    offeredLayouts(options.id, options.layouts, server, boardAxes.length > 0),
    t,
  )

  const model: TableModel<T> = {
    id: options.id,
    rowIds: rowOrder,
    label: options.label,
    specs: arranged.specs,
    plan: arranged.plan,
    movable: arranged.movable,
    moveColumn(id, to) {
      const next = moveColumn(arranged.movable, id, to)
      const declared = specs.flatMap((spec) => (next.includes(spec.id) ? [spec.id] : []))
      const same = next.every((value, index) => value === declared[index])
      state.setDisplay({ order: same ? [] : next })
    },
    pinnedOf: (id) => pinnedIds.includes(id),
    setPinned(id, pinned) {
      const others = pinnedIds.filter((value) => value !== id)
      state.setDisplay({ pinned: pinned ? [...others, id] : others })
    },
    lead,
    numberOf: (id) => numbersById?.get(id),
    resizable(id) {
      const spec = specById.get(id)
      return spec !== undefined && isResizable(spec)
    },
    widthOf(id) {
      const spec = specById.get(id)
      const min = spec === undefined ? 0 : minWidthPx(spec.kind)
      return { px: plannedById.get(id)?.widthPx ?? min, min, max: RESIZE_MAX }
    },
    previewWidth(id, px) {
      const spec = specById.get(id)
      if (px === null || spec === undefined) setPreview(null)
      else setPreview({ id, px: clampWidth(spec.kind, px) })
    },
    setWidth(id, px) {
      const spec = specById.get(id)
      setPreview(null)
      if (spec === undefined || !isResizable(spec)) return
      const { [id]: _previous, ...others } = display.widths ?? {}
      state.setDisplay({
        widths: px === undefined ? others : { ...others, [id]: clampWidth(spec.kind, px) },
      })
    },
    resetWidths() {
      setPreview(null)
      state.setDisplay({ widths: {} })
    },
    layouts,
    layout: shownLayout(options.id, display.layout, layouts),
    setLayout(next) {
      state.updateDisplay(({ layout: _previous, ...rest }) =>
        next === 'table' ? rest : { ...rest, layout: next },
      )
    },
    boardAxes,
    activate,
    rowHeight: display.rowHeight ?? options.rowHeight,
    setRowHeight(height) {
      state.updateDisplay(({ rowHeight: _previous, ...rest }) =>
        height === undefined ? rest : { ...rest, rowHeight: height },
      )
    },
    groupBy: group?.spec.id ?? null,
    groupable(id) {
      const spec = specById.get(id)
      return !server && !nestedRows && spec !== undefined && KIND_DEFAULTS[spec.kind].groupable
    },
    setGroupBy(id) {
      // The collapsed set names values of the old column: a new grouping opens every group.
      state.updateDisplay(({ groupBy: _previous, ...rest }) =>
        id === undefined ? { ...rest, collapsed: [] } : { ...rest, groupBy: id, collapsed: [] },
      )
    },
    aggregateOf(id) {
      const spec = specById.get(id)
      return spec === undefined ? undefined : aggregateOf(spec, display.aggregates, server)
    },
    aggregatesOf(id) {
      const spec = specById.get(id)
      return spec === undefined || server ? [] : aggregatesOf(spec)
    },
    setAggregate(id, fn) {
      const { [id]: _previous, ...others } = display.aggregates ?? {}
      state.setDisplay({ aggregates: fn === undefined ? others : { ...others, [id]: fn } })
    },
    rows,
    items,
    group,
    toggleGroup(value) {
      state.setDisplay({ collapsed: toggled(display.collapsed, value) })
    },
    nested: nestedRows,
    toggleRow(id) {
      const tree = treeOf(id)
      if (tree === undefined || tree.pinned) return
      state.setDisplay({ collapsed: toggled(display.collapsed, id) })
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
    look,
    rowMenu:
      options.contextMenu === false
        ? undefined
        : specs.find((spec) => spec.kind === 'actions')?.actions,
    headerIcons: options.headerIcons ?? look === 'grid',
    phone,
    cardsBelow: options.cardsBelow ?? 'regular',
    cursor: server && 'cursor' in mode ? mode.cursor : undefined,
    // A folded column reads as hidden to every part (the columns menu too) until a reader decides; a part
    // that writes back the visibility it read does not store the fold's hide as the reader's choice.
    state:
      folded === undefined
        ? state
        : {
            ...state,
            display: { ...display, visibility },
            setDisplay: (patch) => state.setDisplay(withoutFold(patch, folded)),
          },
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
        (column) =>
          column.visible &&
          (column.priority === 3 ||
            column.place === 'detail' ||
            (phone === 'columns' && !column.phoneKeep) ||
            // The phone list row draws the title, two values and the answer; any other column is behind the tap.
            (phone === 'cards' &&
              !column.identity &&
              column.place !== 'title' &&
              column.place !== 'kebab' &&
              !column.phoneValue &&
              column.phoneMeta === null)),
      ),
    detailListed: activation.kind !== 'detail',
    format,
    zone: zone ?? 'host',
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
        // A list cell (`tags`, several people) counts under each of its entries.
        for (const entry of Array.isArray(value) ? value : [value]) {
          const key = String(entry)
          counts.set(key, (counts.get(key) ?? 0) + count)
        }
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
    columns: arranged.plan.columns.flatMap((planned, index) => {
      const spec = arranged.specs[index]
      return planned.visible && spec !== undefined && spec.kind !== 'actions'
        ? [{ id: spec.id, header: spec.header, value: spec.value }]
        : []
    }),
  }
  useEffect(() => {
    live.current = { order: rowOrder, step: activation.kind === 'detail' ? activate : showAuto }
  })
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
  picked: string | null | undefined,
): TableModel<T>['group'] {
  if (server) return undefined
  if (group !== undefined && !specs.some((s) => s.id === group.by)) {
    throw new Error(
      `basalt-ui/table: group.by "${group.by}" is not a column; use one of ${specs.map((s) => s.id).join(', ')}`,
    )
  }
  if (picked === null) return undefined
  // A reader's pick holds while its column is still there and groups; else the declared grouping.
  const chosen =
    picked === undefined
      ? undefined
      : specs.find((s) => s.id === picked && KIND_DEFAULTS[s.kind].groupable)
  const by = chosen?.id ?? group?.by
  const spec = by === undefined ? undefined : specs.find((s) => s.id === by)
  if (spec === undefined) return undefined
  // The summary is the declared grouping's: it reads that column's rows.
  const summary = spec.id === group?.by ? group.summary : undefined
  return { spec, ...(summary !== undefined && { summary }) }
}

/**
 * The number of each drawn row (`rowNumbers`): its place in body order from `offset`, the rows of a
 * collapsed group counted too, so a row keeps its number when a group above it closes.
 */
function rowNumbers<T>(items: readonly BodyItem<T>[], offset: number): Map<string, number> {
  const numbers = new Map<string, number>()
  let at = offset
  for (const item of items) {
    if (item.type === 'group') {
      if (item.collapsed) at += item.rows.length
      continue
    }
    at += 1
    numbers.set(item.row.id, at)
  }
  return numbers
}

/** Rows read when sizing a `width: 'content'` column; a longer list is sampled from its head. */
const CONTENT_SAMPLE = 1000

/**
 * The widest loaded value in `ch` of each `width: 'content'` column, by id; `{}` when none. An empty list has no
 * loaded value to measure: a zero width would size a text column to its header, so the empty table packed its
 * columns to the start and the cause centred in the first ones, where the ready table spreads them.
 */
function contentWidths<T>(
  specs: readonly KindSpec<T>[],
  data: readonly T[] | undefined,
): Record<string, number> {
  const widths: Record<string, number> = {}
  if (data === undefined || data.length === 0) return widths
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
  widths: Readonly<Record<string, number>>,
  previewing: boolean,
  look: 'reading' | 'grid',
): TablePlan {
  // A drag re-plans on every pointer move: its dev warnings wait for the width it writes on release.
  const quiet = previewing ? { warn: () => {} } : {}
  // oxlint-disable-next-line react/exhaustive-deps -- `key` IS the shape of `columns`, `visibility`, `contentCh` and `widths`
  return useMemo(() => planTable(columns, { visibility, contentCh, widths, look, ...quiet }), [key])
}
