/**
 * The `table-header` fixture (issue 2418): one client `DataTable` at full width, on its own markup, no shell.
 * Every header shows its controls at rest on a fine pointer: the sort button, the filter button of a filterable
 * column and the column menu. `phone: 'scroll'` keeps the head a table at 390, where the default would turn
 * rows into cards and clip the head.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'
import type { UseDataTable } from '../../../src/table/contract'

type Row = {
  id: string
  name: string
  state: string
  amount: number
  due: string
  qty: number
}

const ROWS: Row[] = [
  { id: 'r1', name: 'Atlas', state: 'Open', amount: 1200, due: '2026-09-03', qty: 4 },
  { id: 'r2', name: 'Beacon', state: 'Done', amount: 1850, due: '2026-09-09', qty: 7 },
  { id: 'r3', name: 'Cobalt', state: 'Open', amount: 2310, due: '2026-09-14', qty: 2 },
  { id: 'r4', name: 'Delta', state: 'Blocked', amount: 980, due: '2026-09-21', qty: 9 },
  { id: 'r5', name: 'Ember', state: 'Done', amount: 4420, due: '2026-10-02', qty: 5 },
  { id: 'r6', name: 'Fjord', state: 'Open', amount: 615, due: '2026-10-08', qty: 11 },
]

const c = col<Row>()

function columns(): UseDataTable<Row>['columns'] {
  return [
    c.entity('name', { header: 'Name' }),
    c.status('state', { header: 'State', options: ['Open', 'Done', 'Blocked'], filter: 'multi' }),
    c.money('amount', { header: 'Amount', currency: 'EUR', filter: 'range' }),
    c.date('due', { header: 'Due', priority: 2 }),
    c.number('qty', { header: 'Qty' }),
  ]
}

function Fixture(): ReactElement {
  const t = useDataTable<Row>({
    id: 'th-table',
    label: 'th-table',
    columns: columns(),
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phone: 'scroll',
  } as UseDataTable<Row>)
  return (
    <main lang="en" className="p-4 text-foreground">
      <div data-testid="th-table" className="w-full min-w-0">
        <DataTable table={t} />
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
