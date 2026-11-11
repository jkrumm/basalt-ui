/**
 * The ONE engine composition of the v3 table: a closed 10-feature set built once at module scope
 * through `createTableHook` (docs/v3/concepts/data-table.md sections 1.2 and 3, "Engine, feature
 * set"). Every `DataTable` runs on this object; nothing outside `src/table` names it.
 *
 * Law of this module:
 * - Built once. The hook result, the feature object and the row-model factories are module-scope
 *   constants, so their identity is stable across renders and imports (v9 re-derives every
 *   prototype when the features object changes identity; TanStack skill `table-state`).
 * - Per-function imports. Each sort and filter function is imported by name (`sortFn_*`,
 *   `filterFn_*`), never the `sortFns`/`filterFns` bundles, so the bundle holds what is registered.
 * - Acyclic. This file imports the engine alone; `kinds` and `plan` import it, never the reverse
 *   (HMR, TanStack #6348). `features.test.tsx` pins the import list.
 * - Isolated contexts. `createTableHookContexts` gives the table its own React contexts, so a
 *   `DataTable` inside another table's `detail` never reads the outer instance.
 *
 * `columnSizing` is not registered: pinned offsets are CSS sums of kind widths (section 3,
 * "Visibility, pinning"). Resize, reorder, tree, export and aggregation are absent on purpose;
 * each is additive later (concept section 10).
 */
import {
  columnFacetingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  columnPinningFeature,
  columnVisibilityFeature,
  createExpandedRowModel,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  createTableHook,
  createTableHookContexts,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  tableFeatures,
} from '@tanstack/react-table'

/**
 * What an engine column carries in `meta`: its kind name. The resolved kind spec is read by column
 * id from the table's own column list (`kinds.tsx`), so `meta` stays a plain string and no
 * per-render closure lands in the engine.
 */
export type EngineColumnMeta = { kind: string }

/** The feature names, in the concept's order. `features.test.tsx` asserts the set is exactly this. */
export const FEATURE_NAMES = [
  'columnFilteringFeature',
  'globalFilteringFeature',
  'columnFacetingFeature',
  'rowSortingFeature',
  'rowPaginationFeature',
  'rowSelectionFeature',
  'columnVisibilityFeature',
  'columnPinningFeature',
  'columnGroupingFeature',
  'rowExpandingFeature',
] as const

/**
 * The registered sort functions. `alphanumeric` is load-bearing: v9 falls back to `basic` for an
 * unregistered name with only a dev warning, which sorts `Project 10` before `Project 2` (I19).
 */
export const SORT_FNS = {
  alphanumeric: sortFn_alphanumeric,
  basic: sortFn_basic,
  datetime: sortFn_datetime,
} as const

export type SortFnName = keyof typeof SORT_FNS

export const tableEngineFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  columnFacetingFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  columnPinningFeature,
  columnGroupingFeature,
  rowExpandingFeature,
  filteredRowModel: createFilteredRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  groupedRowModel: createGroupedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  sortFns: SORT_FNS,
  filterFns: { includesString: filterFn_includesString },
  columnMeta: metaHelper<EngineColumnMeta>(),
})

export type TableEngineFeatures = typeof tableEngineFeatures

/** The table's own React contexts (one set, module scope), handed to `createTableHook`. */
export const tableEngineContexts = createTableHookContexts<TableEngineFeatures>()

/**
 * The hook result: `useAppTable`, `createAppColumnHelper` and the context readers, all bound to the
 * feature set above. `useDataTable` (parts) wraps `useAppTable`; nothing here is public.
 */
export const tableEngine = createTableHook({
  features: tableEngineFeatures,
  tableContext: tableEngineContexts.tableContext,
  cellContext: tableEngineContexts.cellContext,
  headerContext: tableEngineContexts.headerContext,
  globalFilterFn: 'includesString',
})
