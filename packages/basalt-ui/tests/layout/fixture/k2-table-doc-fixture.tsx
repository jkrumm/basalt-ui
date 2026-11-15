/**
 * The `k2-table` document fixture: `DataTable` on its own markup, no shell. Probes, each a
 * `data-testid` box around one table:
 * - `k2-table-entity`: entity cells with a `sub` line;
 * - `k2-table-narrow`: four kinded columns with a long id and sub, in the tier the viewport gives;
 * - `k2-table-scroll`: the same columns with `phone: 'scroll'`, so cells keep their column width;
 * - `k2-table-mid`: the same columns in a 560 px box (the reduced tier, columns side by side);
 * - `w1-orders`: the wiring cycle 1 client table (entity, money, status, date), default `phone`
 *   and `cardsBelow`;
 * - `k2-table-title-first`: a 60-character title with a 70-character sub in a 1500 px table beside
 *   six short columns;
 * - `k2-table-ready-<14|17>`: a loaded table of that many rows;
 * - `k2-table-reload-<14|17>`: the same, flipped to loading by `window.k2Loading(id, true)`.
 */
import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'
import type { UseDataTable } from '../../../src/table/contract'

type Row = { id: string; name: string; sub: string; state: string; change: number; base: number }

const LONG_NAME = 'eval-005-regression-suite-with-an-unusually-long-case-identifier'
const LONG_SUB = 'Sort ascending by the second column and keep the first as written'

const rows = (count: number): Row[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    name: i === 0 ? LONG_NAME : `eval-${String(i).padStart(3, '0')}`,
    sub: i === 0 ? LONG_SUB : 'Sort ascending',
    state: i % 2 === 0 ? 'Passed' : 'Failed',
    change: i % 3 === 0 ? 0.12 : -3.4,
    base: 1000 + i * 37,
  }))

const c = col<Row>()
const c2 = col<Issue>()

function columns(): UseDataTable<Row>['columns'] {
  return [
    c.entity('name', { header: 'Case', sub: (r) => r.sub }),
    c.status('state', { header: 'Result', options: ['Passed', 'Failed'] }),
    c.delta('change', { header: 'Change', polarity: 'up-good', unit: '%' }),
    c.number('base', { header: 'Baseline' }),
  ]
}

type Order = { id: string; customer: string; amount: number; status: string; placed: string }
const ORDERS: Order[] = [
  { id: 'o1', customer: 'Wayne Ltd', amount: 1200, status: 'paid', placed: '2026-11-01' },
  { id: 'o2', customer: 'Stark Inc', amount: 860.5, status: 'pending', placed: '2026-11-03' },
  { id: 'o3', customer: 'Acme', amount: 4300, status: 'failed', placed: '2026-11-07' },
]
const o = col<Order>()

function Orders(): ReactElement {
  const t = useDataTable<Order>({
    id: 'w1-orders',
    label: 'Orders',
    columns: [
      o.entity('customer'),
      o.money('amount', { currency: 'EUR' }),
      o.status('status', { options: ['paid', 'pending', 'failed'] }),
      o.date('placed'),
    ],
    data: ORDERS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} />
}

type Issue = {
  id: string
  ref: string
  project: string
  title: string
  why: string
  state: string
  kind: string
  origin: string
  at: string
}
const TITLE = 'A sixty character issue title that must read in full in its cell'
const WHY = 'A seventy character reason that follows the title and gives way to it first'
const ISSUES: Issue[] = Array.from({ length: 3 }, (_, i) => ({
  id: `t${i}`,
  title: TITLE,
  why: WHY,
  ref: `issue_${1440 + i}`,
  project: 'basalt-ui',
  state: i % 2 === 0 ? 'Open' : 'Done',
  kind: 'bug',
  origin: 'factory',
  at: '2026-11-0' + String(i + 1),
}))

function TitleFirst(): ReactElement {
  const t = useDataTable<Issue>({
    id: 'k2-table-title-first',
    label: 'Issues',
    columns: [
      c2.entity('title', { header: 'Issue', sub: (r) => r.why }),
      c2.text('ref', { header: 'Issue' }),
      c2.text('project', { header: 'Project' }),
      c2.status('state', { header: 'State', options: ['Open', 'Done'] }),
      c2.text('kind', { header: 'Kind' }),
      c2.text('origin', { header: 'Origin' }),
      c2.date('at', { header: 'Opened' }),
    ],
    data: ISSUES,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} />
}

const loaders = new Map<string, (loading: boolean) => void>()
;(window as unknown as { k2Loading: (id: string, loading: boolean) => void }).k2Loading = (
  id,
  loading,
) => loaders.get(id)?.(loading)

function Probe({
  id,
  count,
  phone,
}: {
  id: string
  count: number
  phone?: 'cards' | 'scroll'
}): ReactElement {
  const [loading, setLoading] = useState(false)
  loaders.set(id, setLoading)
  const t = useDataTable<Row>({
    id,
    label: id,
    columns: columns(),
    data: loading ? undefined : rows(count),
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    ...(phone !== undefined && { phone }),
  })
  return <DataTable table={t} />
}

const PROBES: { id: string; count: number; phone?: 'cards' | 'scroll'; width?: number }[] = [
  { id: 'k2-table-entity', count: 4 },
  { id: 'k2-table-narrow', count: 4 },
  { id: 'k2-table-scroll', count: 4, phone: 'scroll' },
  { id: 'k2-table-mid', count: 4, width: 560 },
  { id: 'k2-table-ready-14', count: 14 },
  { id: 'k2-table-ready-17', count: 17 },
  { id: 'k2-table-reload-14', count: 14 },
  { id: 'k2-table-reload-17', count: 17 },
]

function Fixture(): ReactElement {
  return (
    // theme-allow -- the wrappers are the probe's payload (tables in a column)
    <main lang="en" className="flex flex-col gap-8 p-4 text-foreground">
      <div data-testid="w1-orders" className="min-w-0">
        <Orders />
      </div>
      <div data-testid="k2-table-title-first" className="min-w-0" style={{ width: 1500 }}>
        <TitleFirst />
      </div>
      {PROBES.map(({ id, count, phone, width }) => (
        <div
          key={id}
          data-testid={id}
          className="min-w-0"
          style={width === undefined ? undefined : { width }}
        >
          <Probe id={id} count={count} {...(phone !== undefined && { phone })} />
        </div>
      ))}
    </main>
  )
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<Fixture />)
