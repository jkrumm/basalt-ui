/**
 * The `table-view` fixture (docs/v3/issues/bench/bench-table-view.json): the view lane in real Chrome.
 * `tw-grid` is a grid-look table wider than any viewport, with the tick, row numbers and the identity
 * column leading; `tw-virtual` is the same table windowed by `VirtualList` in a bounded box;
 * `tw-rows` is a reading table whose row height the test sets through `window.basaltRowHeight`.
 */
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import type { RowHeight } from '../../src/table/contract'
import { col } from '../../src/table/core/kinds'
import { DataTable } from '../../src/table/parts/data-table'
import { modelOf, useDataTable } from '../../src/table/use-data-table'
import { VirtualList } from '../../src/ui/virtual-list'

type Row = {
  id: string
  name: string
  state: string
  team: string
  region: string
  owner: string
  plan: string
  seats: number
  amount: number
  paid: number
  due: number
  score: number
  usage: number
}

const STATES = ['Open', 'Won', 'Lost'] as const
const rows = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `r${i}`,
    name: `Account ${String(i).padStart(4, '0')}`,
    state: STATES[i % STATES.length] ?? 'Open',
    team: ['Eng', 'Ops', 'Sales'][i % 3] ?? 'Eng',
    region: ['North', 'South', 'East', 'West'][i % 4] ?? 'North',
    owner: `Owner ${i % 7}`,
    plan: ['Free', 'Team', 'Business'][i % 3] ?? 'Free',
    seats: 3 + (i % 40),
    amount: 1000 + i * 13,
    paid: 500 + i * 7,
    due: 100 + i * 3,
    score: i % 100,
    usage: (i * 17) % 1000,
  }))

const c = col<Row>()
const COLUMNS = [
  c.entity('name', { header: 'Account' }),
  c.status('state', { header: 'State', options: [...STATES] }),
  c.text('team', { header: 'Team' }),
  c.text('region', { header: 'Region' }),
  c.text('owner', { header: 'Owner' }),
  c.text('plan', { header: 'Plan' }),
  c.number('seats', { header: 'Seats' }),
  c.money('amount', { header: 'Amount', currency: 'EUR' }),
  c.money('paid', { header: 'Paid', currency: 'EUR' }),
  c.money('due', { header: 'Due', currency: 'EUR' }),
  c.number('score', { header: 'Score' }),
  c.number('usage', { header: 'Usage' }),
  // Wider than 1800 px with the lead columns, so the grid scrolls sideways at every width.
  c.text('owner', { id: 'manager', header: 'Manager' }),
  c.text('region', { id: 'territory', header: 'Territory' }),
  c.text('plan', { id: 'tier', header: 'Tier' }),
]

const GRID = rows(40)
const MANY = rows(2000)

const host = window as unknown as {
  basaltRowHeight?: (height: RowHeight | undefined) => void
  basaltMountFixture: () => Promise<void>
}

function Grid(): ReactElement {
  const t = useDataTable<Row>({
    id: 'tw-grid',
    label: 'Accounts',
    columns: COLUMNS,
    data: GRID,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    look: 'grid',
    rowNumbers: true,
    selection: { bulk: [] },
    onRowActivate: () => undefined,
  })
  return <DataTable table={t} height={{ maxRows: 10 }} />
}

function Windowed(): ReactElement {
  const t = useDataTable<Row>({
    id: 'tw-virtual',
    label: 'Accounts, windowed',
    columns: COLUMNS,
    data: MANY,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    look: 'grid',
    rowNumbers: true,
    selection: { bulk: [] },
    onRowActivate: () => undefined,
  })
  return <DataTable table={t} height={{ maxRows: 10 }} virtual={VirtualList} />
}

function Rows(): ReactElement {
  const t = useDataTable<Row>({
    id: 'tw-rows',
    label: 'Accounts, reading',
    columns: COLUMNS.slice(0, 4),
    data: GRID.slice(0, 6),
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    onRowActivate: () => undefined,
  })
  const model = modelOf(t)
  useEffect(() => {
    host.basaltRowHeight = (height) => model.setRowHeight(height)
  })
  return <DataTable table={t} />
}

function Fixture(): ReactElement {
  return (
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="tw-grid" className="min-w-0">
        <Grid />
      </div>
      <div data-testid="tw-virtual" className="flex h-96 min-w-0 flex-col">
        <Windowed />
      </div>
      <div data-testid="tw-rows" className="min-w-0">
        <Rows />
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
host.basaltMountFixture = async () => {}
document.body.classList.add('bg-background')
localStorage.clear()
createRoot(container).render(<Fixture />)
