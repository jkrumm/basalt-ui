/**
 * The ONE module-scope Table v9 feature set `BasaltDataTable` runs on, and the basalt-owned
 * `createColumnHelper` bound to it. Nothing here but `createColumnHelper` leaves `./table`: the
 * feature set, `useTable` and the row-model factories are implementation, and a consumer never
 * spells `<TFeatures, TData>` (`docs/V2-SPEC.md` § 8).
 */
import {
  columnFilteringFeature,
  columnPinningFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper as tanstackColumnHelper,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from '@tanstack/react-table'
import type { ColumnDef, ColumnHelper, RowData } from '@tanstack/react-table'

/** Horizontal alignment of a column's header AND its cells. */
export type DataTableAlign = 'left' | 'center' | 'right'

/** The one list of cell kinds: the type, the runtime check and its error text derive from it. */
export const DATA_TABLE_COLUMN_KINDS = [
  'entity',
  'status',
  'number',
  'money',
  'relative-time',
  'meter',
  'text',
] as const

/**
 * The cell kinds `meta.kind` names (`docs/waves/design-parity/SPEC.md` § 6.6). Unset keeps the
 * table's plain cell. The chrome and the content each kind supplies live in `cell-kinds.tsx`.
 */
export type DataTableColumnKind = (typeof DATA_TABLE_COLUMN_KINDS)[number]

/**
 * What a column def's `meta` may carry. Registered per table through `columnMeta: metaHelper<…>()`
 * rather than a global `declare module '@tanstack/react-table'`, so `meta: { aling: 'right' }` is a
 * compile error (excess-property check on the literal) and nothing leaks into a consumer's own
 * TanStack types. A wrong align VALUE that reaches runtime still throws at render.
 */
export type BasaltColumnMeta = {
  align?: DataTableAlign
  /**
   * Opt OUT of the automatic mono-numeral cell style. The table applies it whenever the cell's
   * raw value is a number — which is right for a plain figure and wrong for a numeric accessor
   * whose `cell` renders its own chrome (a coloured `Text`, a `Badge`, a sparkline), because the
   * `<td>`'s mono font then overrides what the cell asked for.
   */
  numeral?: boolean
  /**
   * Fold priority for the measured column fold (`docs/CONTROLS-SPEC.md` §2): once the
   * table no longer fits its wrapper, the HIGHEST-numbered priority column folds first, moving
   * into a per-row disclosure instead of forcing the table into horizontal scroll. Unset columns
   * fall back to their declared position, so a bare `<BasaltDataTable data columns />` folds its
   * LAST column first — nothing regresses with no `meta.priority` set anywhere. See `foldOrder`.
   */
  priority?: number
  /**
   * The cell's kind: chrome always, content only when the column has no `cell` renderer of its own
   * (a `cell` still supplies the content). Unset renders exactly the plain cell. A wrong value
   * throws at render, like `align`.
   *
   * - `entity`: never wraps, ink, weight 500; the column's `cell` (glyph + name) or the raw value.
   * - `status`: the status chip; colour from `statusColor`, default `gray`. Never wraps.
   * - `number` / `money`: proportional tabular numerals (SPEC D33, not mono), right-aligned (an explicit `align` wins). Without a
   *   `cell` the raw number is formatted (`integer`; `money` grouped to `currency`'s minor digits, no symbol), null as a muted dash.
   *   The UNIT belongs in the header (`Volume (kg)`, `Salary (USD / yr)`), never in the cell.
   * - `relative-time`: mono, muted; a raw `Date | number | string` renders as `3 hours ago` in a
   *   `<time>`, the full date in a tooltip and as its accessible name.
   * - `meter`: the inline `Meter` bar for the value against `meterMax`.
   * - `text`: plain `sm` ink that MAY wrap — the only kind that does. Every other body cell holds one line, so
   *   the fold measures natural widths and folds or pins instead of fitting by wrapping.
   */
  kind?: DataTableColumnKind
  /** `status`: the chip colour for a cell value — a theme colour name or a CSS var. Default `gray`. */
  statusColor?(value: unknown): string
  /** `meter`: the value that fills the bar. Default 1 (a ratio). */
  meterMax?: number
  /** `money` without a `cell`: the ISO 4217 code that sets the minor digits (the header names it). Default `USD`. */
  currency?: string
}

/**
 * Every row model is registered (v9 has no per-render `getXRowModel` switch); the table bypasses the
 * ones a prop turns off through TanStack's `manual*` flags. `sortFns` is load-bearing: v9 falls back
 * to `basic` for an unregistered sort function with only a dev warning, which sorts `Project 10`
 * before `Project 2`. `columnSizingFeature` is too — `column.getStart`/`getAfter` live there, and
 * sticky pinning reads them.
 */
export const basaltTableFeatures = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnSizingFeature,
  columnPinningFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  filteredRowModel: createFilteredRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    datetime: sortFn_datetime,
    basic: sortFn_basic,
  },
  filterFns: { includesString: filterFn_includesString },
  columnMeta: metaHelper<BasaltColumnMeta>(),
})

export type BasaltTableFeatures = typeof basaltTableFeatures

/**
 * A column def of `BasaltDataTable`'s feature set; the cell value varies per column, hence the `any`.
 * Build columns with `createColumnHelper` below — hand-typing this is not the supported path.
 */
// oxlint-disable-next-line typescript/no-explicit-any -- TanStack-idiomatic heterogeneous column array
export type BasaltColumnDef<T extends RowData> = ColumnDef<BasaltTableFeatures, T, any>

/**
 * Typed accessor builder for `BasaltDataTable` columns: `col.accessor('field', …)` columns sort by
 * value. One generic, the row type — the feature set is basalt's.
 */
export function createColumnHelper<T extends RowData>(): ColumnHelper<BasaltTableFeatures, T> {
  return tanstackColumnHelper<BasaltTableFeatures, T>()
}
