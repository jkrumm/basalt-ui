/** Sprint 47 fixture: 30 tickets, fixed dates, no clock. Day numbers count working days from the sprint start (1 = Monday). */

export type Status = 'todo' | 'progress' | 'review' | 'done'

export const STATUSES = ['todo', 'progress', 'review', 'done'] as const

export const STATUS_LABEL: Readonly<Record<Status, string>> = {
  todo: 'To do',
  progress: 'In progress',
  review: 'In review',
  done: 'Done',
}

export type Ticket = {
  id: string
  title: string
  assignee: string
  status: Status
  /** `null` is a ticket nobody estimated. */
  points: number | null
  daysInStatus: number
  /** The working day the ticket joined the sprint, `null` when planned. */
  addedDay: number | null
}

export const SPRINT = {
  name: 'Sprint 47',
  start: '2026-11-09',
  end: '2026-11-20',
  today: '2026-11-17',
  workDays: 10,
  /** Working days finished by the end of today. */
  elapsedDays: 7,
} as const

export const DAYS_LEFT = SPRINT.workDays - SPRINT.elapsedDays

const T = (
  id: number,
  title: string,
  assignee: string,
  status: Status,
  points: number | null,
  daysInStatus: number,
  addedDay: number | null = null,
): Ticket => ({ id: `S-${id}`, title, assignee, status, points, daysInStatus, addedDay })

const BASE: readonly Ticket[] = [
  T(101, 'Login rate limit', 'Ana', 'done', 3, 6),
  T(102, 'Invoice export as CSV', 'Ben', 'done', 5, 4),
  T(103, 'Fix timezone drift in reports', 'Cara', 'done', 2, 5),
  T(104, 'Audit log index', 'Dev', 'done', 3, 3),
  T(105, 'Retry failed webhooks', 'Ana', 'done', 2, 2),
  T(106, 'Empty cart copy', 'Cara', 'done', 1, 1),
  T(107, 'Upgrade runtime', 'Ben', 'done', 3, 0),
  T(120, 'Hotfix session expiry', 'Dev', 'done', 1, 1, 3),
  T(121, 'Fix PDF footer', 'Cara', 'done', 2, 1, 4),
  T(108, 'Search facets', 'Ben', 'review', 5, 4),
  T(109, 'Role editor', 'Ana', 'review', 5, 1),
  T(110, 'Quota banner', 'Dev', 'review', 3, 3),
  T(111, 'Mail template refresh', 'Cara', 'review', 2, 0),
  T(122, 'SSO claim mapping', 'Dev', 'review', 3, 2, 5),
  T(112, 'Billing webhook handler', 'Ben', 'review', 8, 5),
  T(113, 'Bulk import', 'Ana', 'progress', 8, 6),
  T(114, 'Usage dashboard', 'Cara', 'progress', 5, 3),
  T(115, 'Rate card API', 'Ben', 'progress', 5, 2),
  T(116, 'Dark mode for charts', 'Dev', 'progress', 3, 1),
  T(117, 'Notification preferences', 'Ana', 'progress', 3, 2),
  T(123, 'Fix export timeout', 'Ben', 'progress', 2, 1, 6),
  T(124, 'Mobile navigation', 'Cara', 'progress', 3, 4),
  T(125, 'Locale files', 'Dev', 'progress', 2, 1),
  T(118, 'SCIM provisioning', 'Dev', 'todo', 13, 8),
  T(119, 'Data retention job', 'Ben', 'todo', 8, 8),
  T(126, 'Onboarding checklist', 'Cara', 'todo', 5, 8),
  T(127, 'Docs refresh', 'Ana', 'todo', 2, 8),
  T(128, 'Webhook signing', 'Ana', 'todo', 3, 4, 5),
  T(129, 'Spike: billing sync', 'Ben', 'todo', null, 3, 7),
  T(130, 'Clean up feature flags', 'Cara', 'todo', 1, 8),
]

/** Zero: nothing is done yet, the finished tickets still wait in review. */
const ZERO_DONE: readonly Ticket[] = BASE.map((t) =>
  t.status === 'done' ? { ...t, status: 'review', daysInStatus: 1 } : t,
)

/** Extreme: every ticket is done, so nothing is at risk. */
const ALL_CLEAR: readonly Ticket[] = BASE.map((t) => ({
  ...t,
  status: 'done',
  points: t.points ?? 1,
  daysInStatus: Math.min(t.daysInStatus, 3),
}))

const FIXTURES: Readonly<Record<string, readonly Ticket[]>> = {
  'zero-done': ZERO_DONE,
  'all-clear': ALL_CLEAR,
}

export const ticketsFor = (fixture: string | undefined): readonly Ticket[] =>
  (fixture === undefined ? undefined : FIXTURES[fixture]) ?? BASE

/** A ticket with the reason it is at risk, or '' when it is not. */
export type Item = Ticket & { reason: string }

/** An open ticket is at risk when it cannot finish in the days left at its pace so far. */
function riskReason(t: Ticket): string {
  if (t.status === 'done') return ''
  if (t.points === null) return 'No estimate'
  if (t.status === 'todo' && t.points >= 3) return 'Large, not started'
  if (t.status === 'progress' && t.daysInStatus >= 5) return 'Slow in progress'
  if (t.status === 'review' && t.daysInStatus >= 3) return 'Waiting on review'
  return ''
}

/** Every ticket in reading order: done first, then each open status, the biggest first. */
export function items(tickets: readonly Ticket[]): readonly Item[] {
  return [...STATUSES].toReversed().flatMap((status) =>
    tickets
      .filter((t) => t.status === status)
      .toSorted((a, b) => (b.points ?? 99) - (a.points ?? 99))
      .map((t) => ({ ...t, reason: riskReason(t) })),
  )
}

export type Bucket = {
  status: Status
  label: string
  points: number
  tickets: number
  first: string
  last: string
}

export function buckets(list: readonly Item[]): readonly Bucket[] {
  return [...STATUSES].toReversed().flatMap((status) => {
    const rows = list.filter((t) => t.status === status)
    const first = rows[0]
    const last = rows.at(-1)
    if (first === undefined || last === undefined) return []
    return [
      {
        status,
        label: STATUS_LABEL[status],
        points: rows.reduce((sum, t) => sum + (t.points ?? 0), 0),
        tickets: rows.length,
        first: first.id,
        last: last.id,
      },
    ]
  })
}
