/**
 * ./table — BasaltDataTable: a sortable data table over @tanstack/react-table v9, rendered with
 * Mantine primitives. Opt-in chrome: a search/facet toolbar, a pagination bar (client-side or
 * server-driven) and sticky column pinning. `createColumnHelper` is basalt's own, bound to the
 * table's feature set — no TanStack hook, feature or row-model symbol leaves this subpath.
 *
 * Peers: @tanstack/react-table 9.2.8 (exact) and @base-ui/react (the v3 `col` kinds render
 * `ui/*` primitives).
 *
 * @example
 * import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
 * type Row = { name: string; score: number }
 * const col = createColumnHelper<Row>()
 * const columns = [col.accessor('name', { header: 'Name' }), col.accessor('score', { header: 'Score' })]
 * <BasaltDataTable data={rows} columns={columns} enableGlobalFilter enablePagination />
 */

export { BasaltDataTable } from './data-table'
export { createColumnHelper } from './table-features'
// The element type of `rowActions`, for a module-level constant.
export type { DataTableRowAction } from './data-table'

// v3 (docs/v3/concepts/data-table.md section 5): the kind column factory.
export { col } from './core/kinds'
export { DataTable } from './parts/data-table'
export { useDataTable } from './use-data-table'
