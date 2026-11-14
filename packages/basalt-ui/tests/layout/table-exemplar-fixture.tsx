/**
 * The `table-exemplar` fixture (docs/v3/issues/g3/v3-table-t5-exemplar.json): the three ways a row
 * can be acted on, over seven columns of different kinds, two of them priority 3. No shell. Each
 * probe is a `data-testid` box:
 * - `te-detail`: `detail` and a host, so activating a row shows its detail;
 * - `te-activate`: `onRowActivate`, so activating a row calls the app;
 * - `te-none`: neither, so a row is inert and the table alone carries the data.
 * Every activation lands in `window.basaltLog` for the test to read.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { col } from '../../src/table/core/kinds'
import { DataTable } from '../../src/table/parts/data-table'
import { useDataTable } from '../../src/table/use-data-table'
import type { DetailHost } from '../../src/core/ports'

type Row = {
  id: string
  payee: string
  category: string
  state: string
  amount: number
  count: number
  at: string
  open: boolean
}

const STATES = ['Awaiting', 'Settled', 'Disputed'] as const

const ROWS: Row[] = Array.from({ length: 4 }, (_, i) => ({
  id: `r${i}`,
  payee: i % 2 === 0 ? 'Counterparty Holdings International Limited' : `Acme ${i}`,
  category: `Category ${i}`,
  state: STATES[i % STATES.length] ?? STATES[0],
  amount: 100 + i * 17,
  count: 3 + i,
  at: `2026-11-0${i + 1}`,
  open: i % 2 === 0,
}))

const c = col<Row>()

const host = window as unknown as {
  basaltLog: string[]
  basaltMountFixture: () => Promise<void>
}
host.basaltLog = []

const columns = [
  c.entity('payee', { header: 'Payee' }),
  c.text('category', { header: 'Category' }),
  c.status('state', { header: 'State', options: [...STATES] }),
  c.money('amount', { currency: 'EUR', header: 'Amount' }),
  c.number('count', { header: 'Items', priority: 3 }),
  c.date('at', { header: 'Booked', priority: 3 }),
  c.boolean('open', { header: 'Open', priority: 3 }),
]

const logHost: DetailHost = {
  isOpen: false,
  show: (entry) => host.basaltLog.push(`detail:${entry.title}`),
  hide: () => undefined,
}

const base = {
  columns,
  data: ROWS,
  getRowId: (r: Row) => r.id,
  mode: { kind: 'client' },
} as const

function Detail({ id }: { id: string }): ReactElement {
  const t = useDataTable<Row>({
    ...base,
    id,
    label: `${id} rows`,
    detail: (row) => <p>{row.payee}</p>,
  })
  return <DataTable table={t} detail={logHost} />
}

function Activate({ id }: { id: string }): ReactElement {
  const t = useDataTable<Row>({
    ...base,
    id,
    label: `${id} rows`,
    onRowActivate: (row) => host.basaltLog.push(`row:${row.id}`),
  })
  return <DataTable table={t} />
}

function Inert({ id }: { id: string }): ReactElement {
  const t = useDataTable<Row>({ ...base, id, label: `${id} rows` })
  return <DataTable table={t} />
}

function Fixture(): ReactElement {
  return (
    // theme-allow -- the wrappers are the probe's payload (tables in a column)
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="te-detail" className="min-w-0">
        <Detail id="te-detail" />
      </div>
      <div data-testid="te-activate" className="min-w-0">
        <Activate id="te-activate" />
      </div>
      <div data-testid="te-none" className="min-w-0">
        <Inert id="te-none" />
      </div>
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
host.basaltMountFixture = async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
