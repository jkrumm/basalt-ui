/**
 * Issue 3162, the DataTable reading look: a five-column table in a 1500 px container (`fill`), and a phone-width
 * table (390 px) with a meter and three number columns (`phone`). Entry of `kit-expr19-reading.layout.test.ts`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { col } from '../../../src/table/core/kinds'
import { DataTable } from '../../../src/table/parts/data-table'
import { useDataTable } from '../../../src/table/use-data-table'

type Row = {
  id: string
  name: string
  note: string
  amount: number
  paid: number
  share: number
  open: number
}
const ROWS: readonly Row[] = Array.from({ length: 4 }, (_, i) => ({
  id: `r${i}`,
  name: `Ledger entry ${i}`,
  note: `A note on entry ${i}`,
  amount: 1200.5 * (i + 1),
  paid: 300 * (i + 1),
  share: 20 * (i + 1),
  open: 7 * (i + 1),
}))
const c = col<Row>()

function Fill(): ReactElement {
  const table = useDataTable<Row>({
    id: 'k3162-fill',
    label: 'Ledger',
    columns: [
      c.entity('name', { header: 'Entry' }),
      c.text('note', { header: 'Note' }),
      c.text('id', { header: 'Reference' }),
      c.money('amount', { header: 'Amount', currency: 'EUR', help: 'The booked amount.' }),
      c.number('paid', { header: 'Paid' }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={table} />
}

function Phone(): ReactElement {
  const table = useDataTable<Row>({
    id: 'k3162-phone',
    label: 'Usage',
    columns: [
      c.entity('name', { header: 'Entry' }),
      c.number('amount', { header: 'Amount' }),
      c.number('paid', { header: 'Paid' }),
      c.number('open', { header: 'Open' }),
      c.meter('share', { header: 'Used', max: 100 }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={table} />
}

function Fixture(): ReactElement {
  return (
    <main className="p-4 text-foreground">
      <div data-testid="k3162-fill" style={{ width: 1500 }}>
        <Fill />
      </div>
      <div data-testid="k3162-phone" style={{ width: 390, marginTop: 24 }}>
        <Phone />
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
