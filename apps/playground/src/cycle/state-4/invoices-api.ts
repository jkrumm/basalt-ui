/**
 * State cycle 4 (docs/v3/cycles/state-4.md): the stand-in server behind the invoices page. Fixture,
 * not glue: nothing here is counted.
 *
 * In memory, with latency, a push feed of changes made "elsewhere", a receivables figure that moves
 * on its own (the polled half of the page), and the failures a real API has: a save refused with a
 * field error, and a network failure while the browser is offline. A document load reseeds it.
 */

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'void'

export type Invoice = {
  id: string
  customer: string
  status: InvoiceStatus
  /** Euros, two decimals. */
  amount: number
  /** ISO day, `YYYY-MM-DD`. */
  issued: string
  /** The bank's payment reference; empty until the invoice is paid. */
  reference: string
  /** The customer disputes the amount. */
  disputed: boolean
  note: string
}

export type InvoiceValues = Pick<Invoice, 'status' | 'reference' | 'disputed' | 'note'>

/** What the list query asks for: a resolved window, never a preset name. */
export type InvoiceQuery = {
  from: string
  to: string
  status: readonly InvoiceStatus[]
  q: string
  disputed: boolean
}

export type Receivables = { outstanding: number; overdue: number; at: number }

/** What a refused save throws: the shape `toSubmitErrors` maps onto the form and its fields. */
class ApiError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message)
  }
}

export const STATUSES: readonly InvoiceStatus[] = ['draft', 'sent', 'paid', 'void']
export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
  void: 'Void',
}

const CUSTOMERS = [
  'Brightwater Dairy',
  'Kestrel Aviation',
  'Lumen Print House',
  'Marlow & Daughters',
  'Northgate Clinics',
  'Orchard Lane Bakery',
  'Pinecrest Hotels',
  'Quarry Stone Works',
  'Riverside Rowing Club',
  'Saltmarsh Ferries',
  'Tidewell Pharmacy',
]

const DAY_MS = 86_400_000
const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
const today = (): number => Math.floor(Date.now() / DAY_MS) * DAY_MS
/** The first day of an `n`-day window ending today. */
export const daysAgo = (n: number, now: Date): string =>
  isoDay(Math.floor(now.getTime() / DAY_MS) * DAY_MS - (n - 1) * DAY_MS)
export const isoToday = (now: Date): string => isoDay(now.getTime())

function seed(): Invoice[] {
  const start = today()
  return Array.from({ length: 120 }, (_, i) => {
    const status = STATUSES[(i * 5 + Math.floor(i / 4)) % STATUSES.length]!
    return {
      id: `inv_${(2100 + i).toString()}`,
      customer: CUSTOMERS[(i * 7) % CUSTOMERS.length]!,
      status,
      amount: Math.round((120 + ((i * 53) % 2400) + (i % 7) * 0.35) * 100) / 100,
      issued: isoDay(start - Math.floor(i * 0.75) * DAY_MS),
      reference: status === 'paid' ? `SEPA-${(41_000 + i * 17).toString()}` : '',
      disputed: (i * 11 + 3) % 9 === 0,
      note: '',
    }
  })
}

let invoices = seed()
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** A fetch made while the browser is offline fails the way `fetch` does: a TypeError, no status. */
function network(): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('Failed to fetch')
}

type Change = { event: 'invoice.updated'; id: string; data: string }
const listeners = new Set<(change: Change) => void>()
let sequence = 0

function emit(invoice: Invoice): void {
  sequence += 1
  const change: Change = {
    event: 'invoice.updated',
    id: String(sequence),
    data: JSON.stringify({ kind: 'invoice', id: invoice.id }),
  }
  for (const listener of listeners) listener(change)
}

/** Every call and its kind, so the action driver can tell a poll from a push refetch. */
const calls: { kind: 'list' | 'get' | 'save' | 'stats'; at: number }[] = []
declare global {
  interface Window {
    basaltInvoiceCalls?: typeof calls
  }
}
if (typeof window !== 'undefined') window.basaltInvoiceCalls = calls

export const invoicesApi = {
  async list(query: InvoiceQuery): Promise<Invoice[]> {
    calls.push({ kind: 'list', at: Date.now() })
    await wait(240)
    network()
    const needle = query.q.trim().toLowerCase()
    return invoices.filter(
      (inv) =>
        inv.issued >= query.from &&
        inv.issued <= query.to &&
        (query.status.length === 0 || query.status.includes(inv.status)) &&
        (needle === '' || inv.customer.toLowerCase().includes(needle) || inv.id.includes(needle)) &&
        (!query.disputed || inv.disputed),
    )
  },
  async get(id: string): Promise<Invoice> {
    calls.push({ kind: 'get', at: Date.now() })
    await wait(150)
    network()
    const found = invoices.find((inv) => inv.id === id)
    if (found === undefined) throw new ApiError(`No invoice ${id}.`)
    return found
  },
  async save(id: string, values: InvoiceValues): Promise<Invoice> {
    calls.push({ kind: 'save', at: Date.now() })
    await wait(450)
    network()
    // A server rule the client schema does not know: a paid invoice names its payment reference.
    if (values.status === 'paid' && values.reference.trim() === '') {
      throw new ApiError('Nothing was saved.', {
        reference: 'A paid invoice needs its payment reference.',
      })
    }
    invoices = invoices.map((inv) => (inv.id === id ? { ...inv, ...values } : inv))
    const saved = invoices.find((inv) => inv.id === id)!
    emit(saved)
    return saved
  },
  /** The receivables figure: moves on its own between polls (payments land, invoices age). */
  async stats(): Promise<Receivables> {
    calls.push({ kind: 'stats', at: Date.now() })
    await wait(110)
    network()
    const open = invoices.filter((inv) => inv.status === 'sent')
    const drift = Math.floor(Date.now() / 4000) % 5
    const outstanding = open.reduce((sum, inv) => sum + inv.amount, 0) + drift * 75
    return { outstanding: Math.round(outstanding), overdue: 3 + (drift % 3), at: Date.now() }
  },
  /** Somebody else marks or clears a dispute: the push feed carries it, nothing here asked for it. */
  touchElsewhere(): void {
    const i = Math.floor(Math.random() * invoices.length)
    invoices = invoices.map((inv, k) => (k === i ? { ...inv, disputed: !inv.disputed } : inv))
    emit(invoices[i]!)
  },
  subscribe(listener: (change: Change) => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
