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
export type {
  BasaltDataTableProps,
  BasaltDataTableSlot,
  DataTableAlign,
  DataTableColumnId,
  DataTableColumnPinning,
  DataTableFacet,
  DataTableFacetOption,
} from './data-table'

// ── @tanstack/react-table convenience re-export ───────────────────────────────
// `createColumnHelper` is the one raw TanStack symbol every `BasaltDataTable` call site needs to
// build its `columns` array (C1 consolidation: every OTHER pass-through — `useReactTable`,
// `flexRender`, the row-model builders, and the type re-exports — was unused by any consumer;
// import TanStack directly for those).
export { createColumnHelper } from '@tanstack/react-table'
