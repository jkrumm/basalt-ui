/**
 * State cycle 2 (docs/v3/cycles/state-2.md): the stand-in server behind the tickets page. Fixture, not
 * glue: nothing here is counted.
 *
 * In memory, with latency, a push feed of changes made "elsewhere", a queue figure that moves on its
 * own (the polled half of the page), and the failures a real API has: a save refused with a field
 * error, and a network failure while the browser is offline.
 */

export type Priority = 'urgent' | 'high' | 'normal' | 'low'
export type TicketStatus = 'open' | 'waiting' | 'solved'

export type Ticket = {
  id: string
  subject: string
  requester: string
  priority: Priority
  status: TicketStatus
  /** Empty while nobody owns it. */
  assignee: string
  /** ISO day, `YYYY-MM-DD`. */
  opened: string
  note: string
}

export type TicketValues = Omit<Ticket, 'id' | 'opened' | 'requester'>

/** What the list query asks for: a resolved window, never a preset name. */
export type TicketQuery = {
  from: string
  to: string
  priority: readonly Priority[]
  q: string
  unassigned: boolean
}

export type QueueStats = { open: number; breaching: number; at: number }

/** What a refused save throws: the shape `toSubmitErrors` maps onto the form and its fields. */
class ApiError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message)
  }
}

export const PRIORITIES: readonly Priority[] = ['urgent', 'high', 'normal', 'low']
export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
  low: 'Low',
}
export const STATUSES: readonly TicketStatus[] = ['open', 'waiting', 'solved']
export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Open',
  waiting: 'Waiting',
  solved: 'Solved',
}

const SUBJECTS = [
  'Invoice shows the wrong VAT rate',
  'Cannot reset my password',
  'Export to CSV times out',
  'Webhook retries never stop',
  'Seat count did not update',
  'Two-factor code arrives late',
  'Dashboard is blank in Safari',
  'Refund still pending after a week',
  'API key rotated without notice',
  'Bulk import drops the last row',
]
const REQUESTERS = [
  'Northwind Traders',
  'Acme Logistics',
  'Globex GmbH',
  'Initech',
  'Umbrella Retail',
  'Hooli Systems',
  'Stark Components',
  'Wayne Freight',
]
export const AGENTS = ['Ada', 'Grace', 'Linus', 'Margaret']

const DAY_MS = 86_400_000
const isoDay = (ms: number): string => new Date(ms).toISOString().slice(0, 10)
const today = (): number => Math.floor(Date.now() / DAY_MS) * DAY_MS
/** The first day of an `n`-day window ending today. */
export const daysAgo = (n: number, now: Date): string =>
  isoDay(Math.floor(now.getTime() / DAY_MS) * DAY_MS - (n - 1) * DAY_MS)
export const isoToday = (now: Date): string => isoDay(now.getTime())

function seed(): Ticket[] {
  const start = today()
  return Array.from({ length: 96 }, (_, i) => ({
    id: `tk_${(4100 + i).toString()}`,
    subject: SUBJECTS[(i * 3) % SUBJECTS.length]!,
    requester: REQUESTERS[(i * 5) % REQUESTERS.length]!,
    priority: PRIORITIES[(i * 7 + (i % 3)) % PRIORITIES.length]!,
    status: STATUSES[(i * 2 + (i % 5)) % STATUSES.length]!,
    assignee: i % 4 === 0 ? '' : AGENTS[i % AGENTS.length]!,
    opened: isoDay(start - Math.floor(i * 0.95) * DAY_MS),
    note: '',
  }))
}

let tickets = seed()
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** A fetch made while the browser is offline fails the way `fetch` does: a TypeError, no status. */
function network(): void {
  if (typeof navigator !== 'undefined' && !navigator.onLine) throw new TypeError('Failed to fetch')
}

type Change = { event: 'ticket.updated'; id: string; data: string }
const listeners = new Set<(change: Change) => void>()
let sequence = 0

function emit(ticket: Ticket): void {
  sequence += 1
  const change: Change = {
    event: 'ticket.updated',
    id: String(sequence),
    data: JSON.stringify({ kind: 'ticket', id: ticket.id }),
  }
  for (const listener of listeners) listener(change)
}

/** Every call and its kind, so the action driver can tell a poll from a push refetch. */
const calls: { kind: 'list' | 'get' | 'save' | 'stats'; at: number }[] = []
declare global {
  interface Window {
    basaltTicketCalls?: typeof calls
  }
}
if (typeof window !== 'undefined') window.basaltTicketCalls = calls

export const ticketsApi = {
  async list(query: TicketQuery): Promise<Ticket[]> {
    calls.push({ kind: 'list', at: Date.now() })
    await wait(240)
    network()
    const needle = query.q.trim().toLowerCase()
    return tickets.filter(
      (t) =>
        t.opened >= query.from &&
        t.opened <= query.to &&
        (query.priority.length === 0 || query.priority.includes(t.priority)) &&
        (needle === '' ||
          t.subject.toLowerCase().includes(needle) ||
          t.requester.toLowerCase().includes(needle) ||
          t.id.includes(needle)) &&
        (!query.unassigned || t.assignee === ''),
    )
  },
  async get(id: string): Promise<Ticket> {
    calls.push({ kind: 'get', at: Date.now() })
    await wait(160)
    network()
    const found = tickets.find((t) => t.id === id)
    if (found === undefined) throw new ApiError(`No ticket ${id}.`)
    return found
  },
  async save(id: string, values: TicketValues): Promise<Ticket> {
    calls.push({ kind: 'save', at: Date.now() })
    await wait(500)
    network()
    // A server rule the client schema does not know: an urgent ticket must have an owner.
    if (values.priority === 'urgent' && values.assignee.trim() === '') {
      throw new ApiError('Nothing was saved.', {
        assignee: 'An urgent ticket needs an assignee.',
      })
    }
    tickets = tickets.map((t) => (t.id === id ? { ...t, ...values } : t))
    const saved = tickets.find((t) => t.id === id)!
    emit(saved)
    return saved
  },
  /** The queue figure: changes on its own between polls (tickets arrive and age past their SLA). */
  async stats(): Promise<QueueStats> {
    calls.push({ kind: 'stats', at: Date.now() })
    await wait(120)
    network()
    const open = tickets.filter((t) => t.status !== 'solved').length
    const drift = Math.floor(Date.now() / 4000) % 5
    return { open: open + drift, breaching: 3 + (drift % 3), at: Date.now() }
  },
  /** Somebody else reassigns a ticket: the push feed carries it, nothing on this page asked for it. */
  touchElsewhere(): void {
    const i = Math.floor(Math.random() * tickets.length)
    const ticket = tickets[i]!
    const assignee = AGENTS[(AGENTS.indexOf(ticket.assignee) + 1) % AGENTS.length]!
    tickets = tickets.map((t, k) => (k === i ? { ...t, assignee } : t))
    emit(tickets[i]!)
  },
  subscribe(listener: (change: Change) => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}
