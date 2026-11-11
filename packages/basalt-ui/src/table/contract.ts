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
  DetailHost,
  IconComponent,
  Phase,
  QueryStateLike,
  VirtualLike,
} from '../core/ports'

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
  key: string
  label: string
  onClick(rows: readonly T[], selection: Selection): void
  icon?: IconComponent
}

/** What `useDataTable` returns and `DataTable` and the parts consume; opaque to callers. */
export type DataTableInstance<T> = {
  readonly __brand: 'DataTableInstance'
  readonly __row?: (row: T) => void
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
  key: string
  label: string
  onClick(row: T): void
  icon?: IconComponent
  disabled?(row: T): boolean
  loading?(row: T): boolean
}

// ---- Props --------------------------------------------------------------------------------

export type Scrollport = 'fill' | { maxRows: number }

export type DataTableProps<T> = { table: DataTableInstance<T>; detail?: DetailHost } & (
  | { height?: 'auto' | Scrollport; virtual?: never }
  | { height: Scrollport; virtual: VirtualLike }
)

export type UseDataTable<T> = {
  id: string
  label: string
  columns: readonly KindColumn<T>[]
  data: readonly T[] | undefined
  getRowId: (row: T) => string
  mode: Mode
  state?: StateHandle<TableState>
  phase?: Phase | QueryStateLike
  resetOn?: readonly unknown[]
  phone?: 'cards' | 'scroll'
  cardsBelow?: 'regular' | 'wide' | 'always'
  pager?: 'pages' | 'more' | 'none'
  /** A type error unless `mode.kind` is `'client'` (enforced in `useDataTable` at the call site). */
  group?: {
    by: string
    summary?: (rows: readonly T[], box: Box) => ReactNode
  }
  selection?: { bulk: BulkAction<T>[]; selectAll?: boolean }
  views?: { store?: ViewStore }
} & (
  | { detail: (row: T, box: Box) => ReactNode; onRowActivate?: never }
  | { onRowActivate?: (row: T) => void; detail?: never }
)
