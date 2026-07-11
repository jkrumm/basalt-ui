/**
 * ./data/table — BasaltDataTable: a sortable data table over @tanstack/react-table, rendered
 * with Mantine primitives. Opt-in chrome: a search/facet toolbar, a pagination bar (client-side
 * or server-driven), and sticky column pinning — see `BasaltDataTableProps` for the full surface.
 *
 * Optional peer: @tanstack/react-table >=8 <9.
 *
 * Use this fine subpath instead of the `./data` barrel when your app only needs the table — it
 * does NOT value-import @tanstack/react-virtual, so the virtual-list peer is never required.
 *
 * Install with:
 *   bun add @tanstack/react-table
 *
 * @example
 * import { BasaltDataTable, createColumnHelper } from 'basalt-ui/data/table'
 * type Row = { name: string; score: number }
 * const col = createColumnHelper<Row>()
 * const columns = [col.accessor('name', { header: 'Name' }), col.accessor('score', { header: 'Score' })]
 * <BasaltDataTable data={rows} columns={columns} enableGlobalFilter enablePagination />
 */

// ── BasaltDataTable ───────────────────────────────────────────────────────────
export { BasaltDataTable } from './data-table'
export type { BasaltDataTableProps, DataTableFacet, DataTableFacetOption } from './data-table'

// ── @tanstack/react-table convenience re-exports ──────────────────────────────
// These are the handful of table primitives a consumer needs at the call site;
// importing them from basalt-ui/data/table avoids a separate @tanstack/react-table import.
// useReactTable + flexRender + the row-model builders (getCoreRowModel/getSortedRowModel/
// getFilteredRowModel/getPaginationRowModel) are the raw escape hatch: a bespoke, fully custom
// table can be built from this subpath alone, with no direct @tanstack/react-table import in
// consumer code.
export {
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
} from '@tanstack/react-table'
