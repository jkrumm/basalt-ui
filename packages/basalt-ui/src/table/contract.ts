/**
 * Table contract: the public types of `DataTable`, `useDataTable` and the table state. Types
 * only, no value symbols. Pinned by `check-contract-frozen`; a change needs a
 * `chore: contract amendment` commit. Sketched in docs/v3/concepts/data-table.md section 4.
 *
 * Edge: `table -> controls` only. No composite `.d.ts` names `ui/*`, so the virtual list arrives
 * as `VirtualLike` from `core/ports`.
 */
import type { ReactNode } from 'react'
import type {
  Box,
  ControlHandle,
  DetailHost,
  DragLike,
  IconComponent,
  ListFocus,
  ListFocusItem,
  Phase,
  QueryStateLike,
  VirtualLike,
} from '../core/ports'
import type { CalendarDate } from '../core/format'
import type { Empty } from '../core/phase'

// ---- State (what the URL and saved views carry) -------------------------------------------

export type Priority = 1 | 2 | 3
export type CardSlot =
  | 'title'
  | 'subtitle'
  | 'badge'
  | 'value'
  | 'meta'
  | 'edit'
  | 'detail'
  | 'hidden'

/**
 * One column's filter. `contains` and `anyOf` hold the values the cell may contain or equal;
 * `range` holds `[from, to]`, both inclusive, `''` for an open end: decimal text on a numeric
 * column, `YYYY-MM-DD` days on a date column. A server table maps each model to its query.
 */
export type FilterModel = {
  id: string
  op: 'contains' | 'anyOf' | 'range'
  values: readonly string[]
}

/** Everything that changes the rows a server returns; display toggles never touch it. */
export type TableRequest = {
  q: string
  filters: FilterModel[]
  sort: { id: string; desc: boolean }[]
  page: number
  pageSize: number
  /**
   * The order the user gave a status column's categories, by column id: the column sorts by it and
   * its filter lists the options in it. Absent, the declared `options` order holds.
   */
  ranks?: Readonly<Record<string, readonly string[]>>
}

/**
 * What a reader changed about how the table shows, on the device and in a saved view, never in the
 * URL. `order` lists column ids in the order the reader gave them (the identity column stays first
 * and `actions` last); `pinned` lists the ids a reader pinned to the start of a grid. Absent or
 * empty, the declared order holds and nothing is pinned.
 */
export type TableDisplay = {
  visibility: Record<string, boolean>
  collapsed?: readonly string[]
  order?: readonly string[]
  pinned?: readonly string[]
  /** Column widths in px a reader set by dragging a header edge, by column id; absent, the kind's width. */
  widths?: Readonly<Record<string, number>>
  /** The body's row height; absent, the table's declared `rowHeight`, else the app's density. */
  rowHeight?: RowHeight
  /**
   * The column a reader grouped the rows by (client mode), `null` for none; absent, the declared
   * `group.by` holds.
   */
  groupBy?: string | null
  /** The footer reduce a reader picked per column id, `'none'` for none; absent, the declared `footer`. */
  aggregates?: Readonly<Record<string, Aggregate | 'none'>>
  /**
   * The id of the layout the rows are drawn in; absent is `table`. An id the table does not offer
   * (a saved view from an app that since dropped a layout) draws the table, with a dev warning.
   */
  layout?: string
}

/**
 * The layouts the kit draws itself, all from the one model: `table`; `list`, one line per record
 * from the columns' card slots; `board`, columns by a `select` column whose `commit` a drop calls;
 * `gallery`, a grid of cards from the same slots. Each is a layout spec the table resolves with its
 * own label, hint and glyph; an app adds its own as a `TableLayoutSpec`.
 */
export type BuiltinLayout = 'table' | 'list' | 'board' | 'gallery'

/**
 * What an app's layout draws from: the rows the view shows (searched, filtered, sorted, the current
 * page), in the order the table would draw them, and the table's own ways to open a row.
 */
export type TableLayoutView<T> = {
  readonly rows: readonly T[]
  /** The id `getRowId` gives the row. */
  rowId(row: T): string
  /** Opens the row as a click or Enter on a table row does: its `onRowActivate`, `detail` or derived sheet. */
  open(row: T): void
  /** The row whose detail is open, or that the page named (`activeRowId`). */
  readonly activeId: string | undefined
  /** The table, for the parts a layout may draw itself (`DataTableBody`, `BulkBar`, `TablePager`). */
  readonly table: DataTableInstance<T>
}

/**
 * A layout an app adds to the view row: the toggle, `+ View`'s menu and a saved view name it by
 * `id`. `render` draws the ready rows; the table keeps the bulk bar, the pager, the detail host and
 * the loading, empty and error frames around it, so a layout draws records and nothing else.
 *
 * @example
 * const timeline: TableLayoutSpec<Deal> = {
 *   id: 'timeline',
 *   label: 'Timeline',
 *   hint: 'Deals on their close date',
 *   icon: CalendarRange,
 *   render: (view) => <DealTimeline deals={view.rows} onOpen={view.open} />,
 * }
 */
export type TableLayoutSpec<T> = {
  /** Unique in the table, never a built-in's id: the value a saved view stores. */
  id: string
  label: string
  /** The one line `+ View`'s menu prints under the label. */
  hint?: string
  icon: IconComponent
  render(view: TableLayoutView<T>): ReactNode
}

/** A body row height, in the density words: the row of `dense`, `normal` or `comfortable` (`--basalt-row-h`). */
export type RowHeight = 'dense' | 'normal' | 'comfortable'

/** A footer or group reduce: `count` counts the rows with a value, the rest read a numeric column. */
export type Aggregate = 'sum' | 'mean' | 'min' | 'max' | 'count'

export type TableState = { v: 1; request: TableRequest; display: TableDisplay }

// ---- Pieces the sketch names but does not spell out ---------------------------------------

/**
 * A from-to day picker a date column's range filter draws, passed by value so `./table` adds no
 * peer: `DateRangePicker` from `basalt-ui/ui/date-picker` fits. Days are `YYYY-MM-DD`.
 */
export type DateRangeLike = (props: {
  'aria-label': string
  value: { from?: CalendarDate | null; to?: CalendarDate | null } | null
  onChange: (value: { from: CalendarDate; to: CalendarDate }) => void
  className?: string
}) => ReactNode

/** Facet counts a server returns for the current request, by column id then value. */
export type Facets = Record<string, readonly { value: string; count: number }[]>

/** Server-computed footer values by column id. */
export type Totals = Record<string, number | string | null>

/** A column built by a kind constructor of `col<T>()`; a raw column or free `cell` is not one. */
export type KindColumn<T> = {
  readonly __brand: 'KindColumn'
  readonly id: string
  readonly __row?: (row: T) => void
}

/** Structural state handle (a `ControlHandle` of `table: field.composite(...)` satisfies it). */
export type StateHandle<S> = { use(): [S, (next: S) => void] }

export type BulkAction<T> = {
  id: string
  label: string
  onClick(rows: readonly T[], selection: Selection): void
  icon?: IconComponent
}

/**
 * The `t.table` escape (concept section 4, rung 4): a read view of what the table shows, for an
 * own composite, a board over the same rows or an export. Structural on purpose: no engine type
 * crosses the public `.d.ts`, so the library under the table can change without a break here.
 */
export type TableEscape<T> = {
  /** The page in body order (client: after sort, filter and paging; server: the rows it sent). */
  readonly rows: readonly { readonly id: string; readonly original: T }[]
  /** Every row matching the request: all pages on a client table, the loaded page on a server one. */
  readonly matched: readonly T[]
  /** The visible columns in order, without the actions column; `value` is the kind's raw value. */
  readonly columns: readonly {
    readonly id: string
    readonly header: string
    value(row: T): unknown
  }[]
}

/** What `useDataTable` returns and `DataTable` and the parts consume; read it through `table`. */
export type DataTableInstance<T> = {
  readonly __brand: 'DataTableInstance'
  readonly __row?: (row: T) => void
  readonly table: TableEscape<T>
}

// ---- Mode, selection, views, actions ------------------------------------------------------

/**
 * `client` has no `rowCount`; a server table has either a `rowCount` or a `cursor`, never both.
 * The `never` keys make the exclusion a type error rather than an accepted excess property.
 */
export type Mode =
  | { kind: 'client' }
  | {
      kind: 'server'
      rowCount: number | undefined
      cursor?: never
      facets?: Facets
      totals?: Totals
    }
  | {
      kind: 'server'
      cursor: { hasNext: boolean; fetchNext(): void }
      rowCount?: never
      facets?: Facets
    }

export type Selection =
  | { kind: 'ids'; ids: readonly string[] }
  | { kind: 'all-matching'; request: TableRequest; excluded: readonly string[]; count: number }

/** A saved view: a name over the table state it restores, a tab in the view row. */
export type View = {
  id: string
  name: string
  state: TableState
  /** The view a bare address opens; at most one per table. */
  default?: boolean
  /** Who sees it. Written only through a store with `share`; absent reads as private. */
  sharing?: 'private' | 'shared'
}

/**
 * Where a table's views live when not on the device. `list` returns them in the reader's order (the
 * tabs' order). The optional members are capabilities: without `reorder` the tabs do not move,
 * without `share` the panel has no sharing row, without `count` a tab shows no count.
 */
export type ViewStore = {
  list(table: string): Promise<View[]>
  save(table: string, v: View): Promise<void>
  remove(table: string, id: string): Promise<void>
  /** Writes the order of every view, by id. */
  reorder?(table: string, ids: readonly string[]): Promise<void>
  /** The store can show a view to others: the panel offers private and shared. */
  share?: boolean
  /** How many rows the view matches, for its tab; `undefined` when unknown. */
  count?(table: string, view: View): Promise<number | undefined>
}

export type RowAction<T> = {
  id: string
  label: string
  onClick(row: T): void
  icon?: IconComponent
  disabled?(row: T): boolean
  loading?(row: T): boolean
}

// ---- Props --------------------------------------------------------------------------------

export type Scrollport = 'fill' | { maxRows: number }

export type DataTableProps<T, I = unknown> = {
  table: DataTableInstance<T>
  detail?: DetailHost
} & (
  | {
      /**
       * A chart's focus over the same rows (`useChartFocus(rows, …)`): a row maps to its item by
       * `getRowId`, so sort and filter keep the link. Pointing at a row or moving the table's own row
       * focus onto it focuses its item; an item focused elsewhere marks its row, and a chart's keyboard
       * step onto it scrolls the row into view while it is mounted.
       */
      focus?: ListFocus<T>
      focusSeries?: never
      focusItems?: never
    }
  | {
      focus?: never
      focusSeries?: never
      /**
       * A chart's focus over items of another grain: `holds(row, item)` is true for every item the
       * row stands for (the hours of a window, the probe a finding sits under), never by position.
       * Pointing at a row or moving the table's own row focus onto it focuses every item it holds
       * (`focus.hold`; a cartesian chart draws a run as one x band); a focused item marks every row
       * that holds it, and the rest dim. A row that holds nothing clears the focus.
       *
       * @example
       * <DataTable table={windows} focusItems={{ focus, holds: (w, h) => h.at >= w.from && h.at <= w.to }} />
       */
      focusItems: {
        focus: ListFocus<I>
        holds: (row: T, item: I) => boolean
      }
    }
  | {
      focus?: never
      focusItems?: never
      /**
       * A chart's focus whose series the rows stand for (one row per line): `key` maps a row to its
       * series key. Pointing at a row or moving the table's own row focus onto it emphasises that
       * series across every x; a series emphasised elsewhere (the chart's legend) marks its row.
       */
      focusSeries: {
        focus: {
          readonly setSeries: (key: string | null) => void
          readonly seriesItem: (key: string) => ListFocusItem
        }
        key: (row: T) => string
      }
    }
) &
  (
    | { height?: 'auto' | Scrollport; virtual?: never }
    | { height: Scrollport; virtual: VirtualLike }
  ) & {
    /**
     * The drag engine of the board layout: `drag` from `basalt-ui/ui/sortable-list`. Without it a
     * board card moves by its menu alone.
     */
    drag?: DragLike
  }

/** The options of the detail door, shared by the two forms that open one (`detail`, or `detailById` alone). */
type DetailDoor<T> = {
  /** The title of a row's detail entry (the aside or sheet header); the table label when absent. */
  detailTitle?: (row: T) => string
  /**
   * The title of a record opened by id (see `detailById`): a page that titles a record by its id
   * passes the same function as `detailTitle` reads, so one record has one title however it opened.
   * The table label when absent.
   */
  detailTitleById?: (id: string) => string
  /**
   * A string field of row ids that holds the open row: activating a row writes its id, closing
   * the sheet calls `clear()` (on a `history: 'push'` field the close is an entry of its own, so Back
   * after it returns to the open record; a name that matches no row is cleared as a replace), and a value that names a loaded row opens its detail on load, on
   * a share link and on Back. Without it the open row lives in component state. A host
   * that closes on its own (the page's aside, a caller's panel) clears it too, once a row has
   * shown there, as long as it reports `isOpen`. Pass a stable handle across renders.
   */
  detailState?: ControlHandle<string>
  /**
   * The body of a record the page fetches by id: without `detail` it is every row's body (an
   * activation opens `detailById(getRowId(row), box)`, so the body is written once), with `detail` it
   * is the body of a record no loaded row has, for a `detailState` field that names an unloaded id (a
   * share link after the record left the filters, a row on another page of a server table). Once the
   * query settles the door opens with it, titled by `detailTitleById` (the table label when absent).
   * Closing clears the field. Without it a field naming an unloaded id is cleared and a dev warning
   * names the table and the id.
   */
  detailById?: (id: string, box: Box) => ReactNode
  /**
   * How the record opens until the reader picks another from the panel's `Open as` menu, as
   * `Peek`'s `defaultPresent`: `peek` is the side panel, `window` a floating window, `page` the main
   * area, `drawer` a short panel at the foot of the main area, a third of it tall, that drags up to
   * the whole area while the rows above stay live. Without a shell, or on a phone, `drawer` is a
   * bottom sheet that rests at a third of the screen and drags to full; the other values are the sheet.
   * Default `peek`.
   */
  detailPresent?: 'peek' | 'window' | 'page' | 'drawer'
  onRowActivate?: never
  activeRowId?: never
}

/** One page field the table filters by: a row stays while `match(row, value)` holds. */
export type PageFilter<T, V = unknown> = {
  field: ControlHandle<V>
  match: (row: T, value: V) => boolean
}

/** The filters of `UseDataTable`, one per field, each predicate typed by its own field's value. */
export type PageFilters<T, F extends readonly unknown[]> = { [K in keyof F]: PageFilter<T, F[K]> }

export type UseDataTable<
  T,
  // oxlint-disable-next-line typescript/no-explicit-any -- the default of an unnamed tuple: each field's own `V` is inferred per entry, an explicit `<Row>` call keeps them loose
  F extends readonly unknown[] = readonly any[],
> = {
  id: string
  label: string
  columns: readonly KindColumn<T>[]
  /** Optional while `phase` is a pending query: the table shows its loading phase until rows arrive. */
  data?: readonly T[] | undefined
  getRowId: (row: T) => string
  mode: Mode
  state?: StateHandle<TableState>
  phase?: Phase | QueryStateLike
  /**
   * The rows the page expects: a table that mounts loading draws this many skeleton rows, so the
   * frame does not jump when they arrive. A paged table caps it at the page size; once rows have
   * shown, loading keeps their last height instead, and a server table with a `rowCount` plans its
   * own page. A whole number of at least one.
   *
   * @default 6
   */
  bodyRows?: number
  /**
   * A fixed clock in epoch ms for the relative-time cells (a fixture, a test). Without it they read
   * the clock and tick once a minute.
   */
  now?: number
  /**
   * Why the table has no rows, and what to do about it: its `cause` replaces the default sentence
   * and its `action` renders beside it. A table with no rows left by the page's `filters` shows the
   * `cause` with Clear filters; one filtered by its own search or column filters keeps the
   * no-matches sentence (naming the search only when a phrase is set) and Clear filters;
   * `null` and `undefined` both keep the default.
   * A page that filters the rows itself passes `filtered: { reset }`: the empty arm then offers
   * Clear filters (calling `reset`) in place of `action`, and the table's own filters clear with it.
   */
  empty?: Empty | null
  /**
   * Page fields that narrow a client table's rows (a Section's filters over it): each is a field
   * handle with a row predicate, `match(row, value)` typed by that field's value. A field off its
   * default keeps only the rows its predicate accepts; with none left the empty arm offers Clear
   * filters, which clears exactly these fields (and the table's own search and filters). Ignored on
   * a server table, whose rows are the server's to filter.
   *
   * @example
   * filters: [{ field: store.field.project, match: (row, project) => row.project === project }]
   */
  filters?: PageFilters<T, F>
  resetOn?: readonly unknown[]
  /**
   * What a narrow table becomes: `cards` (the default), a list row: the title, up to two muted meta
   * values under it, the answering value (the card's `value`) at the right edge, and every other
   * column behind the tap; `fields`, the label-and-value grid, each value on a line of its own named
   * by its column header, for a table that is a form of facts; `scroll`, the table scrolling sideways
   * with its first column pinned; or `columns`, the table keeping its header and three columns (the
   * name, the column placed in the card's `value` and the first placed in its `meta` that draws a
   * meter, a delta or a status, else the first placed in it) while the rest move to the row's details:
   * a long numeric table that must keep its answer in view at 390.
   *
   * @default 'cards'
   */
  phone?: 'cards' | 'fields' | 'scroll' | 'columns'
  /**
   * How the table draws its rules. `reading` draws a hairline under each row and drops columns by
   * `priority` as the table narrows: a list a reader scans down and summarises. `grid` draws a rule
   * between every two cells, compact rows and tabular figures, keeps every visible column and
   * scrolls sideways inside its scroller with the identity column pinned: working data a reader
   * compares across and down.
   *
   * @default 'reading'
   */
  look?: 'reading' | 'grid'
  /**
   * Whether a header draws its column icon (each kind's default or the `headerIcon` a column names). The
   * reading look keeps a header to its label, so a right-aligned label ends where its figures end; the
   * grid look names each column by kind.
   *
   * @default false in the reading look, true in the grid look
   */
  headerIcons?: boolean
  /**
   * The width below which the table becomes cards (`regular` is 480 px, `wide` 800 px, `always` never a table).
   *
   * @default 'regular'
   */
  cardsBelow?: 'regular' | 'wide' | 'always'
  /**
   * The pager: `pages` steps through numbered pages, `more` is a Load more button, `none` shows every row.
   *
   * @default 'none' on a client table, 'more' on a cursor table, 'pages' on any other server table
   */
  pager?: 'pages' | 'more' | 'none'
  /**
   * The body's row height until a reader picks one in a view: the density row of `dense` (2rem),
   * `normal` (2.5rem) or `comfortable` (3rem); the head keeps its height. Absent, the app's density.
   */
  rowHeight?: RowHeight
  /**
   * Whether a right click, a long press or Shift+F10 on a row opens the row's actions (the entries of
   * its `c.actions` column) where the pointer is, as its "..." button does. Shift+right click and a
   * click inside a field keep the browser's menu. Without an actions column there is nothing to open.
   *
   * @default true
   */
  contextMenu?: boolean
  /**
   * A row-number column after the tick: the row's place in the request (it runs on across groups and
   * pages). In the grid look it stays pinned with the tick and the identity column; a card hides it.
   */
  rowNumbers?: boolean
  /**
   * The rows grouped by a column, until a reader picks another column or none in a view. A type
   * error unless `mode.kind` is `'client'` (enforced in `useDataTable` at the call site).
   */
  group?: {
    by: string
    summary?: (rows: readonly T[], box: Box) => ReactNode
    /**
     * While the rows are grouped by `by`, its column folds into the group rows: drawn there, not in
     * each row (a space or a team the rows share is no fact of their own). Flat, the column shows; a
     * reader who shows or hides it from the columns menu decides.
     */
    fold?: boolean
  }
  /**
   * Nested rows (client mode only, never with `group`): each row is drawn under the row
   * `parentOf` names, one level deeper, with the indent and the expander the table draws in its
   * first column; a row whose parent is absent, itself or below it is a root. Sort orders the rows
   * within each level, a search or filter keeps every match with the rows above it, and the table
   * becomes a tree grid (Right opens a row or steps into it, Left closes it or steps to its parent).
   * A closed row's id is kept in the display state, so it survives a reload and a saved view. A
   * nested table shows every row: it never pages.
   *
   * @example
   * nested: { parentOf: (issue) => issue.waitsOn[0] }
   */
  nested?: { parentOf: (row: T) => string | null | undefined }
  selection?: { bulk: BulkAction<T>[]; selectAll?: boolean }
  views?: { store?: ViewStore }
  /**
   * The layouts a reader may pick in the view row, in toggle order; the view saves the pick's id. A
   * built-in is named by its id, an app's own layout is a `TableLayoutSpec`. One layout draws no
   * toggle. `board` needs a client table with a `c.select` column (its `commit` is the drop) and is
   * left out with a dev warning otherwise.
   *
   * @default ['table']
   * @example
   * layouts: ['table', 'board', timeline]
   */
  layouts?: readonly (BuiltinLayout | TableLayoutSpec<T>)[]
} & (
  | (DetailDoor<T> & { detail: (row: T, box: Box) => ReactNode })
  | (DetailDoor<T> & { detail?: never; detailById: NonNullable<DetailDoor<T>['detailById']> })
  | {
      onRowActivate?: (row: T) => void
      /**
       * The id of the row the page has open (a detail the page draws itself): that row is drawn as
       * the selected row and carries `aria-current`. With `detail` the table knows the open row itself.
       */
      activeRowId?: string
      detail?: never
      detailTitle?: never
      detailTitleById?: never
      detailState?: never
      detailById?: never
      detailPresent?: never
    }
)
