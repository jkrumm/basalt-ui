/**
 * The deploy board's job list: the newest 200 jobs of six apps over 14 UTC days (7 to 20 Nov 2026),
 * seeded so every build draws the same list. `web` is the busiest app and its jobs reach back only
 * 11 days; three days have no deploy at all; `billing` fails three times in a row on 12 Nov and then
 * recovers; two jobs are still running and one waits in the queue.
 */

export const APPS = ['web', 'api', 'billing', 'search', 'worker', 'docs'] as const
export type App = (typeof APPS)[number]
export type JobStatus = 'success' | 'failed' | 'queued' | 'running'
export type Job = { id: string; app: App; tag: string; status: JobStatus; startedAt: string }

/** The fixture names a page `?fixture=` knows; anything else draws the default list. */
const FIXTURES = ['clean', 'storm'] as const
/** The heat grid's last row: every app's jobs of one day added up. */
export const ALL = 'all'

export type FixtureName = (typeof FIXTURES)[number]

const DAY_MS = 86_400_000
const FIRST_DAY = Date.UTC(2026, 10, 7)
const DAY_COUNT = 14
export const DAYS: readonly string[] = Array.from({ length: DAY_COUNT }, (_, i) =>
  new Date(FIRST_DAY + i * DAY_MS).toISOString().slice(0, 10),
)
/** 8, 14 and 15 Nov: no app deployed. */
const QUIET_DAYS = new Set([1, 7, 8])
/** The busiest app's list starts on 10 Nov, the 200-job cap. */
const WEB_FIRST_DAY = 3

const TOTALS: Record<App, number> = {
  web: 62,
  api: 44,
  billing: 30,
  search: 26,
  worker: 24,
  docs: 14,
}

type Draft = { app: App; day: number; minute: number; status: JobStatus }

const SCRIPTED: readonly Draft[] = [
  { app: 'billing', day: 5, minute: 9 * 60 + 14, status: 'failed' },
  { app: 'billing', day: 5, minute: 10 * 60 + 2, status: 'failed' },
  { app: 'billing', day: 5, minute: 11 * 60 + 40, status: 'failed' },
  { app: 'billing', day: 5, minute: 13 * 60 + 20, status: 'success' },
  { app: 'web', day: 5, minute: 14 * 60 + 5, status: 'failed' },
  { app: 'web', day: 11, minute: 11 * 60 + 20, status: 'failed' },
  { app: 'api', day: 9, minute: 15 * 60 + 41, status: 'failed' },
  { app: 'search', day: 10, minute: 10 * 60 + 12, status: 'failed' },
  { app: 'search', day: 12, minute: 16 * 60 + 30, status: 'failed' },
  { app: 'worker', day: 6, minute: 8 * 60 + 50, status: 'failed' },
  { app: 'web', day: WEB_FIRST_DAY, minute: 6 * 60 + 12, status: 'success' },
  { app: 'api', day: 0, minute: 10 * 60 + 30, status: 'success' },
  { app: 'billing', day: 0, minute: 11 * 60 + 5, status: 'success' },
  { app: 'search', day: 0, minute: 9 * 60 + 40, status: 'success' },
  { app: 'worker', day: 0, minute: 13 * 60 + 15, status: 'success' },
  { app: 'web', day: 13, minute: 13 * 60 + 52, status: 'running' },
  { app: 'api', day: 13, minute: 14 * 60 + 10, status: 'running' },
  { app: 'worker', day: 13, minute: 14 * 60 + 25, status: 'queued' },
]

function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dayWeight(day: number): number {
  if (QUIET_DAYS.has(day)) return 0
  if (day === 0) return 0.3
  return 1
}

function pickDay(app: App, rand: () => number): number {
  const weights = DAYS.map((_, d) => (app === 'web' && d < WEB_FIRST_DAY ? 0 : dayWeight(d)))
  const total = weights.reduce((a, b) => a + b, 0)
  let at = rand() * total
  for (const [d, w] of weights.entries()) {
    at -= w
    if (at < 0) return d
  }
  return DAYS.length - 1
}

function randomDrafts(rand: () => number): Draft[] {
  const drafts: Draft[] = []
  for (const app of APPS) {
    const scripted = SCRIPTED.filter((d) => d.app === app).length
    for (let i = 0; i < TOTALS[app] - scripted; i++) {
      const day = pickDay(app, rand)
      const latest = day === DAY_COUNT - 1 ? 13 * 60 + 40 : 18 * 60 + 30
      let minute = 7 * 60 + Math.floor(rand() * (latest - 7 * 60))
      if (app === 'web' && day === WEB_FIRST_DAY) minute = Math.max(minute, 6 * 60 + 20)
      drafts.push({ app, day, minute, status: 'success' })
    }
  }
  return drafts
}

/** Twelve more `web` jobs on 19 Nov, all failed: one app retrying a broken image. */
function storm(drafts: readonly Draft[], rand: () => number): Draft[] {
  const stormDay = 12
  const moved = new Set<Draft>()
  for (const d of drafts) {
    if (moved.size >= 12) break
    const scripted = SCRIPTED.includes(d)
    if (d.app === 'web' && !scripted && d.day !== stormDay && d.day !== WEB_FIRST_DAY) moved.add(d)
  }
  return drafts.map((d) => {
    if (moved.has(d)) {
      return { ...d, day: stormDay, minute: 8 * 60 + Math.floor(rand() * 180), status: 'failed' }
    }
    if (d.app === 'web' && d.day === stormDay) return { ...d, status: 'failed' }
    return d
  })
}

/** The job list for a fixture name: the default list, `clean` (no job failed) or `storm`. */
export function jobsFor(fixture: string | undefined): Job[] {
  const rand = seeded(77)
  const random = randomDrafts(rand)
  const base = [...SCRIPTED, ...random]
  const drafts =
    fixture === 'storm'
      ? storm(base, rand)
      : fixture === 'clean'
        ? base.map((d) => (d.status === 'failed' ? { ...d, status: 'success' as const } : d))
        : base
  return drafts
    .sort((a, b) => a.day * 1440 + a.minute - (b.day * 1440 + b.minute))
    .map((d, i) => ({
      id: `dj-${1000 + i}`,
      app: d.app,
      tag: Array.from({ length: 7 }, () => Math.floor(rand() * 16).toString(16)).join(''),
      status: d.status,
      startedAt: new Date(FIRST_DAY + d.day * DAY_MS + d.minute * 60_000).toISOString(),
    }))
}

/** One app on one day: the heat grid's item. `seen` is false before the app's list starts. */
export type Cell = {
  id: string
  app: App | typeof ALL
  day: string
  seen: boolean
  total: number
  landed: number
  failed: number
  lastFailedTag: string | null
}

export function cellsOf(jobs: readonly Job[], apps: readonly App[]): Cell[] {
  const firstSeen = new Map<App, string>()
  for (const j of jobs) {
    const day = j.startedAt.slice(0, 10)
    const known = firstSeen.get(j.app)
    if (known === undefined || day < known) firstSeen.set(j.app, day)
  }
  const cells: Cell[] = []
  for (const app of apps) {
    const from = firstSeen.get(app)
    for (const day of DAYS) {
      const own = jobs.filter((j) => j.app === app && j.startedAt.startsWith(day))
      const failedJobs = own.filter((j) => j.status === 'failed')
      cells.push({
        id: `${app}|${day}`,
        app,
        day,
        seen: from !== undefined && day >= from,
        total: own.length,
        landed: own.filter((j) => j.status === 'success').length,
        failed: failedJobs.length,
        lastFailedTag: failedJobs.at(-1)?.tag ?? null,
      })
    }
  }
  for (const day of DAYS) {
    const own = cells.filter((x) => x.day === day)
    const sum = (pick: (x: Cell) => number): number => own.reduce((n, x) => n + pick(x), 0)
    cells.push({
      id: `${ALL}|${day}`,
      app: ALL,
      day,
      seen: true,
      total: sum((x) => x.total),
      landed: sum((x) => x.landed),
      failed: sum((x) => x.failed),
      lastFailedTag: null,
    })
  }
  return cells
}

export type AppRow = {
  app: App
  finished: number
  landed: number
  failed: number
  landedPct: number
}

export function rowsOf(jobs: readonly Job[]): AppRow[] {
  const rows: AppRow[] = []
  for (const app of APPS) {
    const own = jobs
      .filter((j) => j.app === app)
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    const last = own.at(-1)
    if (last === undefined) continue
    const done = own.filter((j) => j.status === 'success' || j.status === 'failed')
    const landed = done.filter((j) => j.status === 'success').length
    const failed = done.length - landed
    rows.push({
      app,
      finished: done.length,
      landed,
      failed,
      landedPct: done.length === 0 ? 100 : Math.round((landed / done.length) * 1000) / 10,
    })
  }
  return rows.sort((a, b) => b.failed - a.failed || b.finished - a.finished)
}

/** The longest run of failed jobs in a row for one app, and the job that ended it, if any did. */
export type Streak = { app: App; length: number; day: string; endedAt: string | null }

export function longestStreak(jobs: readonly Job[]): Streak | null {
  let best: Streak | null = null
  for (const app of APPS) {
    const own = jobs
      .filter((j) => j.app === app && (j.status === 'success' || j.status === 'failed'))
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    let run = 0
    for (const [i, j] of own.entries()) {
      if (j.status === 'failed') {
        run += 1
        const next = own[i + 1]
        const start = own[i - run + 1]
        if (start !== undefined && (best === null || run > best.length)) {
          best = {
            app,
            length: run,
            day: start.startedAt.slice(0, 10),
            endedAt: next === undefined ? null : next.startedAt,
          }
        }
      } else run = 0
    }
  }
  return best
}
