/**
 * The `table-rest` fixture (docs/v3/issues/bench/bench-table-rest.json): the table at rest in real
 * Chrome. `tr-plain` is a reading table with no sort or filter; `tr-state` the same table that the
 * test sorts and filters through `window.basaltTableState`, with a footer and an inline select;
 * `tr-group` groups its rows and sums a footer; `tr-grid` is a grid wider than any viewport.
 */
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { col } from '../../src/table/core/kinds'
import { DataTable } from '../../src/table/parts/data-table'
import { modelOf, useDataTable } from '../../src/table/use-data-table'

type Row = {
  id: string
  name: string
  note: string
  state: string
  category: string
  amount: number
  due: string
}

const STATES = ['Open', 'Won', 'Lost'] as const
const CATEGORIES = ['Housing', 'Food', 'Travel']
const ROWS: Row[] = Array.from({ length: 8 }, (_, i) => ({
  id: `r${i}`,
  name: `Account ${String(i).padStart(4, '0')}`,
  note:
    [
      'Renewal of the annual plan, waiting on the finance team',
      'Upsell to the business tier after the pilot in the north region',
      'New logo from the autumn campaign, first call booked',
    ][i % 3] ?? 'Renewal',
  state: STATES[i % STATES.length] ?? 'Open',
  category: CATEGORIES[i % 3] ?? 'Housing',
  amount: 1000 + i * 137,
  due: `2026-11-${String(10 + i).padStart(2, '0')}`,
}))

const c = col<Row>()
const COLUMNS = [
  c.entity('name', { header: 'Account' }),
  c.text('note', { header: 'Note' }),
  c.status('state', { header: 'State', options: [...STATES], filter: 'multi' }),
  c.money('amount', { header: 'Amount', currency: 'EUR', footer: 'sum' }),
  c.date('due', { header: 'Due' }),
]
const EDIT = c.select('category', {
  header: 'Category',
  label: (r) => `Category of ${r.name}`,
  options: CATEGORIES,
  commit: () => undefined,
})

const host = window as unknown as {
  basaltTableState?: () => void
  basaltMountFixture: () => Promise<void>
}

function Plain(): ReactElement {
  const t = useDataTable<Row>({
    id: 'tr-plain',
    label: 'Accounts',
    columns: COLUMNS,
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} />
}

function State(): ReactElement {
  const t = useDataTable<Row>({
    id: 'tr-state',
    label: 'Accounts, sorted and filtered',
    columns: [...COLUMNS, EDIT],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    onRowActivate: () => undefined,
  })
  const model = modelOf(t)
  useEffect(() => {
    host.basaltTableState = () =>
      model.state.setRequest({
        sort: [{ id: 'amount', desc: false }],
        filters: [{ id: 'state', op: 'anyOf', values: ['Open', 'Won'] }],
      })
  })
  return <DataTable table={t} />
}

function Grouped(): ReactElement {
  const t = useDataTable<Row>({
    id: 'tr-group',
    label: 'Accounts by state',
    columns: COLUMNS,
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    group: { by: 'state' },
  })
  return <DataTable table={t} />
}

function Grid(): ReactElement {
  const t = useDataTable<Row>({
    id: 'tr-grid',
    label: 'Accounts, grid',
    columns: [
      ...COLUMNS,
      EDIT,
      c.text('note', { id: 'owner', header: 'Owner' }),
      c.text('note', { id: 'region', header: 'Region' }),
      c.text('note', { id: 'plan', header: 'Plan' }),
      c.money('amount', { id: 'paid', header: 'Paid', currency: 'EUR' }),
      c.money('amount', { id: 'open', header: 'Open', currency: 'EUR' }),
      c.date('due', { id: 'signed', header: 'Signed' }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    look: 'grid',
  })
  return <DataTable table={t} />
}

function Fixture(): ReactElement {
  return (
    <main lang="en" className="flex flex-col gap-8 text-foreground">
      <div data-testid="tr-plain" className="min-w-0">
        <Plain />
      </div>
      <div data-testid="tr-state" className="min-w-0">
        <State />
      </div>
      <div data-testid="tr-group" className="min-w-0">
        <Grouped />
      </div>
      <div data-testid="tr-grid" className="min-w-0">
        <Grid />
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
