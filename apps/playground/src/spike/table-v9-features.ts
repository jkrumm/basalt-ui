// Spike (W1 ledger): the ONE module-scope feature set basalt would own. Hidden from consumers; the
// bound column helper below is the only symbol that would leave `./data/table`.
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
} from '@tanstack/react-table-v9'
import type { ColumnHelper, RowData } from '@tanstack/react-table-v9'

/** Replaces today's global `declare module '@tanstack/react-table' { interface ColumnMeta }`. */
export type SpikeColumnMeta = {
  align?: 'left' | 'center' | 'right'
  numeral?: boolean
  priority?: number
}

export const BASALT_TABLE_FEATURES = tableFeatures({
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
  // v8 resolved these implicitly; v9 silently falls back to `basic` without them (dev warn only).
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    datetime: sortFn_datetime,
    basic: sortFn_basic,
  },
  filterFns: { includesString: filterFn_includesString },
  columnMeta: metaHelper<SpikeColumnMeta>(),
})

export type BasaltTableFeatures = typeof BASALT_TABLE_FEATURES

/** The consumer-facing helper: same one-generic call shape as v8's `createColumnHelper<T>()`. */
export function createColumnHelper<T extends RowData>(): ColumnHelper<BasaltTableFeatures, T> {
  return tanstackColumnHelper<BasaltTableFeatures, T>()
}
