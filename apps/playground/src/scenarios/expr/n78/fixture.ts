/** Mailbox gateway fixture: six mailboxes, 30 days of mail, the jobs behind each. Seeded, so every build draws the same page. */

export const NOW = Date.UTC(2026, 10, 20, 9, 0)
export const DAYS = 30
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** A mailbox with no successful sync for this long is stalled. */
const STALL_AFTER_MS = HOUR

export type Fixture = 'rest' | 'calm' | 'backlog'

export type MailDay = { day: number; in: number; out: number }

export type Mailbox = {
  id: string
  address: string
  provider: string
  /** Epoch ms of the last successful sync, null when it never synced. */
  lastSuccessAt: number | null
  lastError: string | null
  daily: readonly MailDay[]
  pending: number
  failed: number
  /** Messages in and out over the 30 days before the window. */
  prior: number
}

export type SyncState = 'syncing' | 'stalled' | 'never'

export type MailboxRow = Mailbox & {
  state: SyncState
  silentMinutes: number | null
  in30: number
  out30: number
}

export function parseFixture(raw: string | undefined): Fixture {
  if (raw === 'calm' || raw === 'backlog') return raw
  return 'rest'
}

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Thirty days of mail for one mailbox: a weekday rhythm around a daily level, nothing after `stopDay`. */
function mailDays(seed: number, perDayIn: number, perDayOut: number, stopDay = DAYS): MailDay[] {
  const rand = seeded(seed)
  const start = NOW - (DAYS - 1) * DAY
  return Array.from({ length: DAYS }, (_, i) => {
    const day = start + i * DAY
    if (i >= stopDay) return { day, in: 0, out: 0 }
    const weekday = new Date(day).getUTCDay()
    const rhythm = weekday === 0 || weekday === 6 ? 0.3 : 1
    const noise = 0.7 + rand() * 0.6
    return {
      day,
      in: Math.round(perDayIn * rhythm * noise),
      out: Math.round(perDayOut * rhythm * (0.6 + rand() * 0.8)),
    }
  })
}

const ago = (ms: number): number => NOW - ms

function rest(): Mailbox[] {
  return [
    {
      id: 'finance',
      address: 'finance@acme.example',
      provider: 'Microsoft 365',
      lastSuccessAt: ago(3 * DAY + 5 * HOUR),
      lastError: 'Auth: token expired',
      daily: mailDays(11, 22, 6, 27),
      pending: 58,
      failed: 14,
      prior: 640,
    },
    {
      id: 'newhire',
      address: 'newhire@acme.example',
      provider: 'Fastmail',
      lastSuccessAt: null,
      lastError: 'Auth: bad credentials',
      daily: mailDays(12, 0, 0, 0),
      pending: 1,
      failed: 6,
      prior: 0,
    },
    {
      id: 'support',
      address: 'support@acme.example',
      provider: 'Fastmail',
      lastSuccessAt: ago(2 * MINUTE),
      lastError: 'SMTP 452: mailbox full',
      daily: mailDays(13, 96, 41),
      pending: 27,
      failed: 1,
      prior: 3380,
    },
    {
      id: 'ops',
      address: 'ops@acme.example',
      provider: 'Gmail',
      lastSuccessAt: ago(4 * MINUTE),
      lastError: null,
      daily: mailDays(14, 52, 17),
      pending: 3,
      failed: 0,
      prior: 1720,
    },
    {
      id: 'billing',
      address: 'billing@acme.example',
      provider: 'Microsoft 365',
      lastSuccessAt: ago(11 * MINUTE),
      lastError: 'Throttled (429)',
      daily: mailDays(15, 34, 12),
      pending: 12,
      failed: 2,
      prior: 1310,
    },
    {
      id: 'archive',
      address: 'archive@acme.example',
      provider: 'Gmail',
      lastSuccessAt: ago(6 * MINUTE),
      lastError: null,
      daily: mailDays(16, 0, 0, 0),
      pending: 0,
      failed: 0,
      prior: 0,
    },
  ]
}

/** Every mailbox synced within the last quarter hour and nothing has failed. */
function calm(): Mailbox[] {
  return rest().map((m, i) => ({
    ...m,
    lastSuccessAt: ago((3 + i * 2) * MINUTE),
    lastError: null,
    daily:
      m.id === 'finance' ? mailDays(11, 22, 6) : m.id === 'newhire' ? mailDays(12, 9, 3) : m.daily,
    pending: m.id === 'support' ? 2 : 0,
    failed: 0,
    prior: m.id === 'newhire' ? 150 : m.prior,
  }))
}

/** One mailbox with a mountain of jobs and a mail flood, the rest as they were. */
function backlog(): Mailbox[] {
  return rest().map((m) =>
    m.id === 'finance'
      ? { ...m, pending: 48_213, failed: 3_106 }
      : m.id === 'support'
        ? { ...m, daily: mailDays(13, 400, 160), prior: 3380 }
        : m,
  )
}

function mailboxesOf(fixture: Fixture): Mailbox[] {
  if (fixture === 'calm') return calm()
  if (fixture === 'backlog') return backlog()
  return rest()
}

function rowOf(m: Mailbox): MailboxRow {
  const silentMs = m.lastSuccessAt === null ? null : NOW - m.lastSuccessAt
  const state: SyncState =
    silentMs === null ? 'never' : silentMs > STALL_AFTER_MS ? 'stalled' : 'syncing'
  return {
    ...m,
    state,
    silentMinutes: silentMs === null ? null : Math.round(silentMs / MINUTE),
    in30: m.daily.reduce((n, d) => n + d.in, 0),
    out30: m.daily.reduce((n, d) => n + d.out, 0),
  }
}

const RANK: Record<SyncState, number> = { never: 0, stalled: 1, syncing: 2 }

/** The mailboxes that need a hand first, then by mail volume. */
export function rowsOf(fixture: Fixture): MailboxRow[] {
  return mailboxesOf(fixture)
    .map(rowOf)
    .toSorted((a, b) => RANK[a.state] - RANK[b.state] || b.in30 + b.out30 - (a.in30 + a.out30))
}
