/**
 * ./data — TanStack Table + Virtual adapter battery for basalt-ui apps.
 *
 * Provides a sortable data table (BasaltDataTable — with opt-in search/facet toolbar, pagination,
 * and column pinning) and a windowed virtual list (BasaltVirtualList), both rendered with Mantine
 * primitives over headless TanStack logic.
 *
 * Optional peers:
 *  - @tanstack/react-table  >=8 <9  (BasaltDataTable)
 *  - @tanstack/react-virtual >=3.13.26 <4  (BasaltVirtualList)
 *
 * BasaltVirtualList itself works on any 3.x; the declared floor is set by ./agent-chat's
 * ThreadTranscript virtualize mode (it calls scrollToEnd/anchorTo, added in virtual-core 3.16.0,
 * first pinned by react-virtual 3.13.26). npm has one peer range per package, so do not lower it.
 *
 * Install with:
 *   bun add @tanstack/react-table @tanstack/react-virtual
 *
 * Convenience barrel — pulls both peer groups. Use the fine subpaths
 * (`basalt-ui/data/table`, `basalt-ui/data/virtual`) for per-feature opt-in.
 *
 * @example
 * // Data table:
 * import { BasaltDataTable, createColumnHelper } from 'basalt-ui/data'
 * type Row = { name: string; score: number }
 * const col = createColumnHelper<Row>()
 * const columns = [col.accessor('name', { header: 'Name' }), col.accessor('score', { header: 'Score' })]
 * <BasaltDataTable data={rows} columns={columns} />
 *
 * @example
 * // Virtual list:
 * import { BasaltVirtualList } from 'basalt-ui/data'
 * const items = Array.from({ length: 10_000 }, (_, i) => ({ id: i, label: `Row ${i}` }))
 * <BasaltVirtualList items={items} height={400} renderItem={(item) => <div>{item.label}</div>} />
 */

// ── BasaltDataTable (+ @tanstack/react-table re-exports) ──────────────────────
export {
  BasaltDataTable,
  type BasaltDataTableProps,
  type DataTableAlign,
  type DataTableColumnId,
  type DataTableColumnPinning,
  type DataTableFacet,
  type DataTableFacetOption,
  createColumnHelper,
  useReactTable,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnHelper,
  type PaginationState,
  type ColumnPinningState,
  type ColumnFiltersState,
} from './table'

// ── BasaltVirtualList ─────────────────────────────────────────────────────────
export {
  BasaltVirtualList,
  type BasaltVirtualListHandle,
  type BasaltVirtualListProps,
} from './virtual'
