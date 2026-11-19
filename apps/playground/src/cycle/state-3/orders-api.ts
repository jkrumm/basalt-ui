/**
 * State cycle 3 (docs/v3/cycles/state-3.md): the stand-in server behind the orders page. Fixture, not
 * glue: nothing here is counted.
 *
 * In memory, with latency, a push feed of changes made "elsewhere", a fulfilment figure that moves on
 * its own (the polled half of the page), and the failures a real API has: a save refused with a field
 * error, and a network failure while the browser is offline.
 */

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'refunded'

export type Order = {
  id: string
  customer: string
  status: OrderStatus
  /** Euros, two decimals. */
  total: number
  /** ISO day, `YYYY-MM-DD`. */
  placed: string
  /** Empty until the parcel has a carrier number. */
  tracking: string
  /** Held for a manual fraud check. */
  flagged: boolean
  note: string
}

export type OrderValues = Pick<Order, 'status' | 'tracking' | 'flagged' | 'note'>

/** What the list query asks for: a resolved window, never a preset name. */
export type OrderQuery = {
  from: string
  to: string
  status: readonly OrderStatus[]
  q: string
  flagged: boolean
}

export type FulfilmentStats = { awaiting: number; late: number; at: number }

/** What a refused save throws: the shape `toSubmitErrors` maps onto the form and its fields. */
class ApiError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message)
  }
}

export const STATUSES: readonly OrderStatus[] = ['pending', 'paid', 'shipped', 'refunded']
export const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pending',
  paid: 'Paid',
  shipped: 'Shipped',
  refunded: 'Refunded',
}

const CUSTOMERS = [
  'Northwind Traders',
  'Acme Logistics',
  'Globex GmbH',
  'Initech',
  'Umbrella Retail',
  'Hooli Systems',
  'Stark Components',
  'Wayne Freight',
  'Tyrell Optics',
  'Soylent Foods',
]

const DAY_MS = 86_400_000
const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
const today = (): number => Math.floor(Date.now() / DAY_MS) * DAY_MS
/** The first day of an `n`-day window ending today. */
export const daysAgo = (n: number, now: Date): string =>
  isoDay(Math.floor(now.getTime() / DAY_MS) * DAY_MS - (n - 1) * DAY_MS)
export const isoToday = (now: Date): string => isoDay(now.getTime())

function seed(): Order[] {
  const start = today()
  return Array.from({ length: 110 }, (_, i) => {
    const status = STATUSES[(i * 3 + Math.floor(i / 3)) % STATUSES.length]!
    return {
      id: `or_${(5100 + i).toString()}`,
      customer: CUSTOMERS[(i * 7) % CUSTOMERS.length]!,
      status,
      total: Math.round((19 + ((i * 37) % 480) + (i % 9) * 0.45) * 100) / 100,
      placed: isoDay(start - Math.floor(i * 0.8) * DAY_MS),
      tracking: status === 'shipped' ? `DHL${(880_000 + i * 13).toString()}` : '',
      flagged: (i * 13 + 5) % 7 === 0,
      note: '',
    }
  })
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

/** Every call and its kind, so the action driver can tell a poll from a push refetch. */
const calls: { kind: 'list' | 'get' | 'save' | 'stats'; at: number }[] = []
declare global {
  interface Window {
    basaltOrderCalls?: typeof calls
  }
}
if (typeof window !== 'undefined') window.basaltOrderCalls = calls

export const ordersApi = {
  async list(query: OrderQuery): Promise<Order[]> {
    calls.push({ kind: 'list', at: Date.now() })
    await wait(260)
    network()
    const needle = query.q.trim().toLowerCase()
    return orders.filter(
      (o) =>
        o.placed >= query.from &&
        o.placed <= query.to &&
        (query.status.length === 0 || query.status.includes(o.status)) &&
        (needle === '' || o.customer.toLowerCase().includes(needle) || o.id.includes(needle)) &&
        (!query.flagged || o.flagged),
    )
  },
  async get(id: string): Promise<Order> {
    calls.push({ kind: 'get', at: Date.now() })
    await wait(160)
    network()
    const found = orders.find((o) => o.id === id)
    if (found === undefined) throw new ApiError(`No order ${id}.`)
    return found
  },
  async save(id: string, values: OrderValues): Promise<Order> {
    calls.push({ kind: 'save', at: Date.now() })
    await wait(500)
    network()
    // A server rule the client schema does not know: a shipped order has a carrier number.
    if (values.status === 'shipped' && values.tracking.trim() === '') {
      throw new ApiError('Nothing was saved.', {
        tracking: 'A shipped order needs a tracking number.',
      })
    }
    orders = orders.map((o) => (o.id === id ? { ...o, ...values } : o))
    const saved = orders.find((o) => o.id === id)!
    emit(saved)
    return saved
  },
  /** The fulfilment figure: changes on its own between polls (orders arrive and age past a day). */
  async stats(): Promise<FulfilmentStats> {
    calls.push({ kind: 'stats', at: Date.now() })
    await wait(120)
    network()
    const awaiting = orders.filter((o) => o.status === 'paid').length
    const drift = Math.floor(Date.now() / 4000) % 5
    return { awaiting: awaiting + drift, late: 2 + (drift % 3), at: Date.now() }
  },
  /** Somebody else flags or clears an order: the push feed carries it, nothing here asked for it. */
  touchElsewhere(): void {
    const i = Math.floor(Math.random() * orders.length)
    orders = orders.map((o, k) => (k === i ? { ...o, flagged: !o.flagged } : o))
    emit(orders[i]!)
  },
  subscribe(listener: (change: Change) => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
