/**
 * The `table-sheet` fixture: a four-column client table imported from `basalt-ui/table` and
 * nothing else. The test builds it with Vite, with and without `basalt()`, and never gives the app
 * `basalt-ui/table.css`.
 */
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { DataTable, col, useDataTable } from 'basalt-ui/table'

type Row = { id: string; customer: string; city: string; total: number; items: number }

const ROWS: Row[] = Array.from({ length: 4 }, (_, i) => ({
  id: `r${i}`,
  customer: `Customer ${i} of the Orders page`,
  city: ['Berlin', 'Hamburg', 'Munich', 'Cologne'][i] ?? 'Berlin',
  total: 1200 + i * 35,
  items: 2 + i,
}))

const c = col<Row>()

function Orders(): ReactElement {
  const t = useDataTable<Row>({
    id: 'orders',
    label: 'Orders',
    columns: [
      c.entity('customer', { header: 'Customer' }),
      c.text('city', { header: 'City' }),
      c.money('total', { currency: 'EUR', header: 'Total' }),
      c.number('items', { header: 'Items' }),
    ],
    data: ROWS,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })
  return <DataTable table={t} />
}

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
;(window as unknown as { basaltMountFixture: () => Promise<void> }).basaltMountFixture =
  async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(
  // theme-allow -- the wrapper is the probe's payload
  <main lang="en" className="p-4 text-foreground" data-testid="orders">
    <Orders />
  </main>,
)
