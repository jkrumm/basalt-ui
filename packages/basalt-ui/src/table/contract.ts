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
  IconComponent,
  ListFocus,
  Phase,
  QueryStateLike,
  VirtualLike,
} from '../core/ports'
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

export type FilterModel = { id: string; op: 'contains' | 'anyOf'; values: readonly string[] }

/** Everything that changes the rows a server returns; display toggles never touch it. */
export type TableRequest = {
  q: string
  filters: FilterModel[]
  sort: { id: string; desc: boolean }[]
  page: number
  pageSize: number
}

export type TableDisplay = { visibility: Record<string, boolean>; collapsed?: readonly string[] }

export type TableState = { v: 1; request: TableRequest; display: TableDisplay }

// ---- Pieces the sketch names but does not spell out ---------------------------------------

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

export type View = { id: string; name: string; state: TableState }

export type ViewStore = {
  list(table: string): Promise<View[]>
  save(table: string, v: View): Promise<void>
  remove(table: string, id: string): Promise<void>
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

export type DataTableProps<T> = {
  table: DataTableInstance<T>
  detail?: DetailHost
  /**
   * A chart's focus over the same rows (`useChartFocus(rows, …)`): a row maps to its item by
   * `getRowId`, so sort and filter keep the link. Pointing at a row or moving the table's own row
   * focus onto it focuses its item; an item focused elsewhere marks its row, and a chart's keyboard
   * step onto it scrolls the row into view while it is mounted.
   */
  focus?: ListFocus<T>
} & (
  | { height?: 'auto' | Scrollport; virtual?: never }
  | { height: Scrollport; virtual: VirtualLike }
)

export type UseDataTable<T> = {
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
   * A fixed clock in epoch ms for the relative-time cells (a fixture, a test). Without it they read
   * the clock and tick once a minute.
   */
  now?: number
  /**
   * Why the table has no rows, and what to do about it: its `cause` replaces the default sentence
   * and its `action` renders beside it. A table filtered by its own search or filters keeps the
   * no-matches sentence and Clear filters; `null` and `undefined` both keep the default.
   * A page that filters the rows itself passes `filtered: { reset }`: the empty arm then offers
   * Clear filters (calling `reset`) in place of `action`, and the table's own filters clear with it.
   */
  empty?: Empty | null
  resetOn?: readonly unknown[]
  /**
   * What a narrow table becomes: cards, or the table scrolling sideways with its first column pinned.
   *
   * @default 'cards'
   */
  phone?: 'cards' | 'scroll'
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
  /** A type error unless `mode.kind` is `'client'` (enforced in `useDataTable` at the call site). */
  group?: {
    by: string
    summary?: (rows: readonly T[], box: Box) => ReactNode
  }
  selection?: { bulk: BulkAction<T>[]; selectAll?: boolean }
  views?: { store?: ViewStore }
} & (
  | {
      detail: (row: T, box: Box) => ReactNode
      /** The title of a row's detail entry (the aside or sheet header); the table label when absent. */
      detailTitle?: (row: T) => string
      /**
       * A string field of row ids that holds the open row: activating a row writes its id, closing
       * the sheet calls `clear()`, and a value that names a loaded row opens its detail on load, on
       * a share link and on Back. Without it the open row lives in component state. A host
       * that closes on its own (the page's aside, a caller's panel) clears it too, once a row has
       * shown there, as long as it reports `isOpen`. Pass a stable handle across renders.
       */
      detailState?: ControlHandle<string>
      /**
       * The body of a record the table has not loaded, for a `detailState` field that names an id no
       * loaded row has (a share link after the record left the filters, a row on another page of a
       * server table): once the query settles the detail door opens with this body under the table
       * label, and the page fetches the record by id. Closing clears the field. Without it a field
       * naming an unloaded id is cleared and a dev warning names the table and the id.
       */
      detailById?: (id: string, box: Box) => ReactNode
      onRowActivate?: never
      activeRowId?: never
    }
  | {
      onRowActivate?: (row: T) => void
      /**
       * The id of the row the page has open (a detail the page draws itself): that row is drawn as
       * the selected row and carries `aria-current`. With `detail` the table knows the open row itself.
       */
      activeRowId?: string
      detail?: never
      detailTitle?: never
      detailState?: never
      detailById?: never
    }
)
