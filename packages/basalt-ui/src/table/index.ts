/**
 * ./table — BasaltDataTable: a sortable data table over @tanstack/react-table, rendered with
 * Mantine primitives. Opt-in chrome: a search/facet toolbar, a pagination bar (client-side or
 * server-driven) and sticky column pinning. Table v9 and a basalt-owned `createColumnHelper`
 * land in a later wave; this is the 1.x behaviour at its new home.
 *
 * Optional peer: @tanstack/react-table >=8 <9.
 *
 * @example
 * import { BasaltDataTable, createColumnHelper } from 'basalt-ui/table'
 * type Row = { name: string; score: number }
 * const col = createColumnHelper<Row>()
 * const columns = [col.accessor('name', { header: 'Name' }), col.accessor('score', { header: 'Score' })]
 * <BasaltDataTable data={rows} columns={columns} enableGlobalFilter enablePagination />
 */

export { BasaltDataTable } from './data-table'
export { createColumnHelper } from '@tanstack/react-table'
