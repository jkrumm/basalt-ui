/** Seeded week of closed Issues for scenario expr-n31: deterministic, UTC, 7 days ending Tue 17 Nov 2026 12:00. */

export type Kind = 'feat' | 'fix' | 'chore'
export type Outcome = 'done' | 'dropped'

export type ClosedIssue = {
  id: number
  title: string
  kind: Kind
  outcome: Outcome
  closedAt: number
}

export type Day = {
  key: string
  at: number
  feat: number
  fix: number
  chore: number
  done: number
  dropped: number
  issues: readonly ClosedIssue[]
}

export type Week = {
  days: readonly Day[]
  sha: string
  deployedAt: number
  deployDayKey: string
  priorShipped: number
}

const NOW = Date.UTC(2026, 10, 17, 12, 0)

const FIRST_DAY = Date.UTC(2026, 10, 11)
const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

const TITLES = [
  'Retry the webhook on a 502',
  'Ledger export drops the last row',
  'Move the nightly sync to the queue',
  'Add a dry-run flag to the importer',
  'Fix the timezone in the invoice header',
  'Bump the base image',
  'Cache account lookups for a minute',
  'Show the failed step on the run page',
  'Rename the staging environment',
  'Stop double-posting refunds',
  'Paginate the audit trail',
  'Drop the legacy CSV route',
  'Explain a rejected payout in the UI',
  'Pin the build toolchain',
  'Batch the balance recalculation',
  'Handle an empty statement file',
  'Add a health check to the worker',
  'Clean up the old migration scripts',
  'Let a run be cancelled from the list',
  'Fix the flaky reconcile test',
  'Surface the retry count',
  'Split the settings page',
  'Trim the payload of the status feed',
  'Guard the export against a closed period',
  'Document the rollback steps',
  'Raise the queue concurrency',
  'Fix the off-by-one in the week view',
  'Index the transactions by account',
]

/** The default week: a quiet Saturday with nothing closed, three Issues dropped. */
const DEFAULT_COUNTS = [4, 5, 6, 0, 1, 5, 4] as const
/** An extreme week: one day closes 14 of the 25. */
const BURST_COUNTS = [1, 2, 14, 0, 1, 3, 4] as const

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickKind(r: number): Kind {
  if (r < 0.4) return 'feat'
  if (r < 0.75) return 'fix'
  return 'chore'
}

function buildWeek(counts: readonly number[]): Week {
  const rand = seeded(311)
  const total = counts.reduce((sum, n) => sum + n, 0)
  const droppedAt = new Set<number>()
  while (droppedAt.size < 3) droppedAt.add(Math.floor(rand() * total))

  let n = 0
  let id = 1938
  const days = counts.map((count, i): Day => {
    const at = FIRST_DAY + i * DAY_MS
    const last = at + DAY_MS > NOW
    const hours = Array.from({ length: count }, () => {
      const span = last ? 4 : 11
      return 7 + Math.floor(rand() * span) + Math.floor(rand() * 60) / 60
    }).sort((a, b) => a - b)
    const issues = hours.map((h): ClosedIssue => {
      const issue: ClosedIssue = {
        id: id++,
        title: TITLES[(n * 9 + 3) % TITLES.length] ?? 'Untitled',
        kind: pickKind(rand()),
        outcome: droppedAt.has(n) ? 'dropped' : 'done',
        closedAt: at + Math.round(h * HOUR_MS),
      }
      n++
      return issue
    })
    const done = issues.filter((x) => x.outcome === 'done')
    return {
      key: new Date(at).toISOString().slice(0, 10),
      at,
      feat: done.filter((x) => x.kind === 'feat').length,
      fix: done.filter((x) => x.kind === 'fix').length,
      chore: done.filter((x) => x.kind === 'chore').length,
      done: done.length,
      dropped: issues.length - done.length,
      issues,
    }
  })
  const deployedAt = Date.UTC(2026, 10, 16, 14, 20)
  return {
    days,
    sha: '4f9c2e1',
    deployedAt,
    deployDayKey: '2026-11-16',
    priorShipped: 18,
  }
}

export const DEFAULT_WEEK: Week = buildWeek(DEFAULT_COUNTS)
export const BURST_WEEK: Week = buildWeek(BURST_COUNTS)
