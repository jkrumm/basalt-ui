/** Seeded, deterministic factory-week data: friction reasons, Issue outcomes, fix commits and idle capacity. */

export const CLASSES = ['gate', 'review', 'spec', 'deploy'] as const
export type ClassKey = (typeof CLASSES)[number]

export type Reason = {
  id: string
  name: string
  now: number
  prev: number
  change: number
  isNew: boolean
}
export type Week = {
  id: string
  done: number
  dropped: number
  cancelled: number
  open: number
  commits: Readonly<Record<ClassKey, number>>
}
export type Day = { key: string; day: Date; idle: number; weekId: string; weekend: boolean }
export type Data = { reasons: readonly Reason[]; weeks: readonly Week[]; days: readonly Day[] }

const REASONS: readonly (readonly [string, string, number, number])[] = [
  ['review-wait', 'Review wait', 21, 12],
  ['gate-flake', 'Gate flake', 17, 11],
  ['spec-ambiguity', 'Spec ambiguity', 14, 13],
  ['deploy-retry', 'Deploy retry', 12, 12],
  ['lease-conflict', 'Lease conflict', 11, 15],
  ['context-overflow', 'Context overflow', 9, 7],
  ['missing-fixture', 'Missing fixture', 8, 10],
  ['worktree-drift', 'Worktree drift', 7, 4],
  ['signal-backlog', 'Signal backlog', 7, 0],
  ['stale-branch', 'Stale branch', 6, 9],
  ['token-limit', 'Token limit', 5, 5],
  ['merge-race', 'Merge race', 4, 1],
]

/** Weeks W40 to W47: done, dropped, cancelled, still open; fix commits for gate, review, spec, deploy. W43 ends no Issue done. */
const WEEKS: readonly (readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
])[] = [
  [9, 4, 2, 6, 14, 8, 5, 3],
  [11, 3, 1, 7, 15, 9, 6, 2],
  [8, 5, 2, 9, 12, 11, 4, 4],
  [0, 6, 3, 12, 9, 13, 3, 2],
  [10, 7, 2, 10, 13, 12, 5, 3],
  [12, 6, 1, 9, 16, 10, 6, 1],
  [11, 4, 3, 8, 18, 9, 7, 2],
  [13, 5, 2, 7, 23, 8, 6, 0],
]

/** The first Monday of the window: eight whole weeks, W40 to W47, end on Sun 22 Nov. */
const FIRST_DAY = Date.UTC(2026, 8, 28, 12)
const DAYS = 56
const DAY_MS = 86_400_000

function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function idleDays(): readonly Day[] {
  const rand = seeded(65)
  return Array.from({ length: DAYS }, (_, i) => {
    const weekend = i % 7 >= 5
    const base = weekend ? 13 + rand() * 6 : 4 + rand() * 7
    // The extreme: all of Sun 15 Nov idle but 2.5 h. The zero: Wed 18 Nov, every agent busy.
    const idle = i === 48 ? 21.5 : i === 51 ? 0 : Math.round(base * 2) / 2
    const day = new Date(FIRST_DAY + i * DAY_MS)
    return {
      key: day.toISOString().slice(0, 10),
      day,
      idle,
      weekId: `W${40 + Math.floor(i / 7)}`,
      weekend,
    }
  })
}

function reasons(surge: boolean): readonly Reason[] {
  return REASONS.map(([id, name, now, prev]) => {
    const spiked = surge && id === 'gate-flake'
    const n = spiked ? 142 : now
    return { id, name, now: n, prev, change: n - prev, isNew: prev === 0 }
  }).toSorted((a, b) => b.change - a.change)
}

export function loadData(fixture: string | undefined): Data {
  const surge = fixture === 'surge'
  const days = idleDays()
  const weeks = WEEKS.map(([done, dropped, cancelled, open, gate, review, spec, deploy], i) => ({
    id: `W${40 + i}`,
    done,
    dropped: surge && i === 6 ? 58 : dropped,
    cancelled,
    open,
    commits: { gate, review, spec, deploy },
  }))
  return { reasons: reasons(surge), weeks, days }
}

export const NO_DATA: Data = { reasons: [], weeks: [], days: [] }

export const ended = (w: Week) => w.done + w.dropped + w.cancelled
export const commitTotal = (w: Week) => CLASSES.reduce((sum, k) => sum + w.commits[k], 0)
