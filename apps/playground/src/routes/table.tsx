import { createFileRoute } from '@tanstack/react-router'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from 'basalt-ui/ui/table'
import { useV3Tokens } from '../demo/v3-tokens'

type Status = 'paid' | 'pending' | 'failed' | 'refunded'

type Order = {
  id: string
  customer: string
  status: Status
  amount: number
  date: string
}

const ORDERS: readonly Order[] = [
  {
    id: 'ord_8f3a21',
    customer: 'Northwind Traders',
    status: 'paid',
    amount: 12480.5,
    date: '2026-11-09',
  },
  {
    id: 'ord_8f3a22',
    customer: 'Acme Logistics',
    status: 'pending',
    amount: 3290,
    date: '2026-11-09',
  },
  { id: 'ord_8f3a23', customer: 'Globex GmbH', status: 'paid', amount: 845.9, date: '2026-11-08' },
  { id: 'ord_8f3a24', customer: 'Initech', status: 'failed', amount: 1999.99, date: '2026-11-08' },
  {
    id: 'ord_8f3a25',
    customer: 'Umbrella Retail',
    status: 'paid',
    amount: 27315.2,
    date: '2026-11-08',
  },
  {
    id: 'ord_8f3a26',
    customer: 'Hooli Systems',
    status: 'refunded',
    amount: 640,
    date: '2026-11-07',
  },
  {
    id: 'ord_8f3a27',
    customer: 'Stark Components',
    status: 'paid',
    amount: 9120.75,
    date: '2026-11-07',
  },
  {
    id: 'ord_8f3a28',
    customer: 'Wayne Freight',
    status: 'pending',
    amount: 15750,
    date: '2026-11-07',
  },
  {
    id: 'ord_8f3a29',
    customer: 'Wonka Confections',
    status: 'paid',
    amount: 412.3,
    date: '2026-11-06',
  },
  {
    id: 'ord_8f3a2a',
    customer: 'Soylent Foods',
    status: 'paid',
    amount: 5870.1,
    date: '2026-11-06',
  },
  {
    id: 'ord_8f3a2b',
    customer: 'Cyberdyne Labs',
    status: 'failed',
    amount: 22000,
    date: '2026-11-06',
  },
  {
    id: 'ord_8f3a2c',
    customer: 'Tyrell Optics',
    status: 'paid',
    amount: 1340.45,
    date: '2026-11-05',
  },
  {
    id: 'ord_8f3a2d',
    customer: 'Oscorp Materials',
    status: 'pending',
    amount: 7210.8,
    date: '2026-11-05',
  },
  { id: 'ord_8f3a2e', customer: 'Pied Piper', status: 'paid', amount: 98.5, date: '2026-11-05' },
  {
    id: 'ord_8f3a2f',
    customer: 'Vandelay Imports',
    status: 'refunded',
    amount: 2760.25,
    date: '2026-11-04',
  },
  {
    id: 'ord_8f3a30',
    customer: 'Massive Dynamic',
    status: 'paid',
    amount: 18430,
    date: '2026-11-04',
  },
  {
    id: 'ord_8f3a31',
    customer: 'Aperture Supply',
    status: 'paid',
    amount: 3105.6,
    date: '2026-11-04',
  },
  {
    id: 'ord_8f3a32',
    customer: 'Gringotts Finance',
    status: 'pending',
    amount: 64200,
    date: '2026-11-03',
  },
  {
    id: 'ord_8f3a33',
    customer: 'Monarch Solutions',
    status: 'paid',
    amount: 775.05,
    date: '2026-11-03',
  },
  {
    id: 'ord_8f3a34',
    customer: 'Dunder Paper',
    status: 'failed',
    amount: 530.4,
    date: '2026-11-03',
  },
  {
    id: 'ord_8f3a35',
    customer: 'Sterling Archer Ltd',
    status: 'paid',
    amount: 4920,
    date: '2026-11-02',
  },
  {
    id: 'ord_8f3a36',
    customer: 'Prestige Worldwide',
    status: 'paid',
    amount: 11875.9,
    date: '2026-11-02',
  },
  {
    id: 'ord_8f3a37',
    customer: 'Bluth Company',
    status: 'refunded',
    amount: 1260,
    date: '2026-11-01',
  },
  { id: 'ord_8f3a38', customer: 'Los Pollos', status: 'paid', amount: 289.75, date: '2026-11-01' },
  {
    id: 'ord_8f3a39',
    customer: 'Nakatomi Trading',
    status: 'pending',
    amount: 8340.2,
    date: '2026-11-01',
  },
]

const DOT: Record<Status, string> = {
  paid: 'bg-good',
  pending: 'bg-warn',
  failed: 'bg-bad',
  refunded: 'bg-faint',
}

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'EUR' })
const day = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** One status: a dot and the word, so the verdict never rests on colour alone. */
function StatusCell({ status }: { status: Status }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${DOT[status]}`} />
      <span className="capitalize">{status}</span>
    </span>
  )
}

// #region dense-table
function OrdersTable({ size }: { size: 'md' | 'compact' }) {
  return (
    <Table size={size}>
      <TableCaption>Orders, newest first. Amounts in EUR.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Order</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Status</TableHead>
          <TableHead numeric>Amount</TableHead>
          <TableHead numeric>Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ORDERS.map((order) => (
          <TableRow key={order.id}>
            <TableCell>
              <span data-numeric className="text-micro text-muted-foreground">
                {order.id}
              </span>
            </TableCell>
            <TableCell>{order.customer}</TableCell>
            <TableCell>
              <StatusCell status={order.status} />
            </TableCell>
            <TableCell numeric>{money.format(order.amount)}</TableCell>
            <TableCell numeric className="text-muted-foreground">
              {day.format(new Date(order.date))}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
// #endregion dense-table

/** The scroll container: a long table scrolls inside it, its head sticks, a phone scrolls sideways. */
function Frame({
  title,
  note,
  children,
}: {
  title: string
  note: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-md font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <div
        data-surface="card"
        className="max-h-[70dvh] overflow-auto rounded-card bg-card shadow-card"
      >
        {children}
      </div>
    </section>
  )
}

function TableRoute() {
  useV3Tokens()
  return (
    <div className="flex flex-col gap-8 p-4">
      <Frame
        title="Table, md"
        note="Row height follows the density row height (32 px dense, 44 px on touch)."
      >
        <OrdersTable size="md" />
      </Frame>
      <Frame title="Table, compact" note="Fixed 28 px rows; 44 px on a coarse pointer.">
        <OrdersTable size="compact" />
      </Frame>
    </div>
  )
}

export const Route = createFileRoute('/table')({
  staticData: { title: 'Table' },
  component: TableRoute,
})
