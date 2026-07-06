/**
 * ./data — TanStack Table + Virtual adapter battery for basalt-ui apps.
 *
 * Provides a sortable data table (BasaltDataTable) and a windowed virtual list
 * (BasaltVirtualList), both rendered with Mantine primitives over headless TanStack logic.
 *
 * Optional peers:
 *  - @tanstack/react-table  >=8 <9  (BasaltDataTable)
 *  - @tanstack/react-virtual >=3 <4  (BasaltVirtualList)
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
export * from './table'

// ── BasaltVirtualList ─────────────────────────────────────────────────────────
export * from './virtual'
