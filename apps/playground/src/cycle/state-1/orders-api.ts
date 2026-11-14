/**
 * State cycle 1 (docs/v3/cycles/state-1.md): the stand-in server behind the orders page.
 *
 * In memory, with latency, a push feed of changes made "elsewhere", and the failures a real API
 * has: a refused save with a field error, and a network failure while the browser is offline.
 */

export type OrderStatus = 'paid' | 'pending' | 'failed' | 'refunded'

export type Order = {
  id: string
  customer: string
  status: OrderStatus
  amount: number
  /** ISO date, `YYYY-MM-DD`. */
  date: string
  flagged: boolean
  note: string
}

export type OrderValues = Omit<Order, 'id' | 'date'>

/** What the list query asks for: a resolved window, never a preset name. */
export type OrderQuery = {
  from: string
  to: string
  status: readonly OrderStatus[]
  q: string
  flagged: boolean
}

/** What a refused save throws: the shape `toSubmitErrors` maps onto the form and its fields. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message)
  }
}

export const STATUSES: readonly OrderStatus[] = ['paid', 'pending', 'failed', 'refunded']
export const STATUS_LABELS: Record<OrderStatus, string> = {
  paid: 'Paid',
  pending: 'Pending',
  failed: 'Failed',
  refunded: 'Refunded',
}

/** Above this amount a save is refused: the server wants an approval the form cannot give. */
export const APPROVAL_LIMIT = 50_000

const CUSTOMERS = [
  'Northwind Traders',
  'Acme Logistics',
  'Globex GmbH',
  'Initech',
  'Umbrella Retail',
  'Hooli Systems',
  'Stark Components',
  'Wayne Freight',
  'Wonka Confections',
  'Soylent Foods',
  'Cyberdyne Labs',
  'Tyrell Optics',
]

const DAY_MS = 86_400_000
export const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
const today = (): number => Math.floor(Date.now() / DAY_MS) * DAY_MS

function seed(): Order[] {
  const start = today()
  return Array.from({ length: 72 }, (_, i) => ({
    id: `ord_${(0x8f3a00 + i).toString(16)}`,
    customer: CUSTOMERS[(i * 7) % CUSTOMERS.length]!,
    status: STATUSES[(i * 5 + (i % 3)) % STATUSES.length]!,
    amount: Math.round((400 + ((i * 7919) % 26_000)) * 100) / 100,
    date: isoDay(start - Math.floor(i * 1.25) * DAY_MS),
    flagged: i % 6 === 0,
    note: '',
  }))
}

let orders = seed()
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** A fetch made while the browser is offline fails the way `fetch` does: a TypeError, no status. */
function network(): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('Failed to fetch')
}

type Change = { event: 'order.updated'; id: string; data: string }
const listeners = new Set<(change: Change) => void>()
let sequence = 0

function emit(order: Order): void {
  sequence += 1
  const change: Change = {
    event: 'order.updated',
    id: String(sequence),
    data: JSON.stringify({ kind: 'order', id: order.id }),
  }
  for (const listener of listeners) listener(change)
}

export const ordersApi = {
  async list(query: OrderQuery): Promise<Order[]> {
    await wait(220)
    network()
    const needle = query.q.trim().toLowerCase()
    return orders.filter(
      (o) =>
        o.date >= query.from &&
        o.date <= query.to &&
        (query.status.length === 0 || query.status.includes(o.status)) &&
        (needle === '' || o.customer.toLowerCase().includes(needle) || o.id.includes(needle)) &&
        (!query.flagged || o.flagged),
    )
  },
  async get(id: string): Promise<Order> {
    await wait(160)
    network()
    const found = orders.find((o) => o.id === id)
    if (found === undefined) throw new ApiError(`No order ${id}.`)
    return found
  },
  async save(id: string, values: OrderValues): Promise<Order> {
    await wait(600)
    network()
    if (values.amount > APPROVAL_LIMIT) {
      throw new ApiError('Nothing was saved.', {
        amount: `Above ${APPROVAL_LIMIT.toLocaleString('en')} needs a finance approval.`,
      })
    }
    const next = orders.map((o) => (o.id === id ? { ...o, ...values } : o))
    orders = next
    const saved = next.find((o) => o.id === id)!
    emit(saved)
    return saved
  },
  /** Somebody else edits an order: the push feed carries it, nothing on this page asked for it. */
  touchElsewhere(): void {
    const i = Math.floor(Math.random() * orders.length)
    const order = orders[i]!
    const amount = Math.round(order.amount * (0.9 + Math.random() * 0.2) * 100) / 100
    orders = orders.map((o, k) => (k === i ? { ...o, amount } : o))
    emit(orders[i]!)
  },
  subscribe(listener: (change: Change) => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

export const presetDays = { '7d': 7, '30d': 30, '90d': 90 } as const
export const daysAgo = (n: number): string => isoDay(today() - (n - 1) * DAY_MS)
export const todayIso = (): string => isoDay(today())
