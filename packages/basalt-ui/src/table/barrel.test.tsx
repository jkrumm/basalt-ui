/**
 * The `./table` barrel as a consumer sees it: every import below comes from `./index` and nothing
 * else, so a part, the codec or a contract type that drops out of the barrel fails here. Covers
 * the `t.table` escape (the read view an export or a board is built on).
 */
import { cleanup, render, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import {
  BulkBar,
  DataTableBody,
  TablePager,
  TableToolbar,
  col,
  tableCodec,
  useDataTable,
} from './index'
import type {
  DataTableInstance,
  Mode,
  Selection,
  TableCodec,
  TableRequest,
  TableSchema,
  TableState,
  View,
  ViewStore,
} from './index'

afterEach(cleanup)

type Row = { id: string; name: string; amount: number }
const ROWS: Row[] = [
  { id: 'a', name: 'Alpha', amount: 3 },
  { id: 'b', name: 'Beta', amount: 1 },
  { id: 'c', name: 'Gamma', amount: 2 },
]
const c = col<Row>()
const schema: TableSchema = c.codec({ name: 'entity', amount: 'number' })

function useRows(mode: Mode = { kind: 'client' }): DataTableInstance<Row> {
  return useDataTable<Row>({
    id: 'barrel-test',
    label: 'Rows',
    columns: [c.entity('name', { header: 'Name' }), c.number('amount', { header: 'Amount' })],
    data: ROWS,
    getRowId: (r) => r.id,
    mode,
  })
}

const Parts = (): ReactElement => {
  const t = useRows()
  return (
    <div>
      <TableToolbar table={t} />
      <BulkBar table={t} />
      <table>
        <DataTableBody table={t} />
      </table>
      <TablePager table={t} />
    </div>
  )
}

describe('the parts compose from the barrel', () => {
  test('each part renders over one instance', () => {
    const { container } = render(<Parts />)
    expect(container.querySelector('[data-slot="table-toolbar"]')).not.toBeNull()
    expect(container.querySelectorAll('tbody tr')).toHaveLength(3)
  })
})

describe('tableCodec', () => {
  test('is a composite codec for a schema and round-trips a state', () => {
    const codec: TableCodec = tableCodec(schema)
    expect(codec.kind).toBe('composite')
    const state: TableState = {
      ...codec.fallback,
      request: { ...codec.fallback.request, q: 'alpha', page: 2 } satisfies TableRequest,
    }
    const decoded = codec.decode('t', codec.encode('t', state))
    expect(decoded?.request.q).toBe('alpha')
    expect(decoded?.request.page).toBe(2)
  })
})

describe('the contract types', () => {
  test('a view store and a selection are typed from the barrel', () => {
    const view: View = { id: 'v', name: 'V', state: tableCodec(schema).fallback }
    const store: ViewStore = {
      list: () => Promise.resolve([view]),
      save: () => Promise.resolve(),
      remove: () => Promise.resolve(),
    }
    const selection: Selection = { kind: 'ids', ids: ['a'] }
    expect(store).toBeDefined()
    expect(selection.kind).toBe('ids')
  })
})

describe('t.table', () => {
  test('rows are the page, matched the whole match, columns the visible ones', () => {
    const { result } = renderHook(() => useRows())
    const { table } = result.current
    expect(table.rows.map((row) => row.id)).toEqual(['a', 'b', 'c'])
    expect(table.matched.map((row) => row.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(table.columns.map((column) => column.id)).toEqual(['name', 'amount'])
    expect(table.columns.map((column) => column.header)).toEqual(['Name', 'Amount'])
    expect(table.columns[1]?.value(ROWS[0] as Row)).toBe(3)
  })

  test('a server table exposes the page it was given', () => {
    const { result } = renderHook(() => useRows({ kind: 'server', rowCount: 99 }))
    expect(result.current.table.rows).toHaveLength(3)
  })
})
