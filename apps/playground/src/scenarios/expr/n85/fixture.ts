/**
 * The loop ledger of scenario expr-n85: a seeded, deterministic list of Issues per loop, folded into
 * one row per loop and window. The same seed always draws the same Issues; the named fixtures change
 * the plan, never the generator.
 */

export type LoopId = 'lint' | 'flaky' | 'dead' | 'docs'
export type WindowId = '7d' | '30d'

/** One Issue a loop filed: how long ago, how it ended, and the hours it took to close. */
export type Issue = {
  id: string
  loop: LoopId
  hoursAgo: number
  outcome: 'gain' | 'flat' | 'unmeasured' | 'dropped' | 'open'
  closeHours: number | null
}

/** One row of the ledger: a loop over one window. `gain` is null where the loop keeps no pass record. */
export type Row = {
  id: string
  loopId: LoopId
  loop: string
  window: WindowId
  windowLabel: string
  opened: number
  gain: number | null
  flat: number
  unmeasured: number
  dropped: number
  open: number
  medianHours: number | null
}

const LOOPS: readonly { id: LoopId; name: string; hasPassRecord: boolean }[] = [
  { id: 'lint', name: 'Lint drift', hasPassRecord: true },
  { id: 'flaky', name: 'Flaky tests', hasPassRecord: true },
  { id: 'dead', name: 'Dead code', hasPassRecord: false },
  { id: 'docs', name: 'Docs drift', hasPassRecord: false },
]

const WINDOW_LABEL: Readonly<Record<WindowId, string>> = {
  '7d': '7 days',
  '30d': '30 days',
}

export const HOURS_IN_WEEK = 168
export const HOURS_IN_MONTH = 720

/** What a loop filed, as counts per outcome, for the last week and for the weeks before it. */
type Plan = Record<LoopId, { recent: Counts; older: Counts }>
type Counts = {
  gain: number
  flat: number
  unmeasured: number
  dropped: number
  open: number
  today: number
}

const none: Counts = { gain: 0, flat: 0, unmeasured: 0, dropped: 0, open: 0, today: 0 }

/** About 40 Issues in 30 days, 12 in the last 7; Lint drift holds 30 of them and 9 dropped; three open Issues were filed today. */
const REST_PLAN: Plan = {
  lint: {
    recent: { gain: 2, flat: 1, unmeasured: 0, dropped: 1, open: 4, today: 2 },
    older: { gain: 9, flat: 5, unmeasured: 0, dropped: 8, open: 0, today: 0 },
  },
  flaky: {
    recent: { gain: 1, flat: 0, unmeasured: 0, dropped: 0, open: 2, today: 1 },
    older: { gain: 1, flat: 1, unmeasured: 0, dropped: 1, open: 0, today: 0 },
  },
  dead: {
    recent: { ...none, unmeasured: 1 },
    older: { ...none, unmeasured: 1, dropped: 1 },
  },
  docs: { recent: none, older: { ...none, dropped: 1 } },
}

/** A surge: one loop files far more than the rest, so every scale must hold the extreme. */
const SURGE_PLAN: Plan = {
  ...REST_PLAN,
  lint: {
    recent: { gain: 14, flat: 9, unmeasured: 0, dropped: 21, open: 26, today: 3 },
    older: { gain: 31, flat: 22, unmeasured: 0, dropped: 38, open: 0, today: 0 },
  },
}

/** Nothing filed in either window: every count is a real zero, every median absent. */
const IDLE_PLAN: Plan = {
  lint: { recent: none, older: none },
  flaky: { recent: none, older: none },
  dead: { recent: none, older: none },
  docs: { recent: none, older: none },
}

const PLANS = { surge: SURGE_PLAN, idle: IDLE_PLAN } as const

/** mulberry32: a small seeded generator, so the fixture never changes between runs. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Typical hours to close, per loop: the slowest loop closes in days, the quickest in hours. */
const CLOSE_HOURS: Readonly<Record<LoopId, readonly [number, number]>> = {
  lint: [3, 40],
  flaky: [10, 60],
  dead: [40, 150],
  docs: [8, 16],
}

function issuesOf({ plan, seed }: { plan: Plan; seed: number }): Issue[] {
  const rand = seeded(seed)
  const issues: Issue[] = []
  for (const loop of LOOPS) {
    const [lo, hi] = CLOSE_HOURS[loop.id]
    for (const span of ['recent', 'older'] as const) {
      const counts = plan[loop.id][span]
      let todayLeft = counts.today
      for (const outcome of ['gain', 'flat', 'unmeasured', 'dropped', 'open'] as const) {
        for (let i = 0; i < counts[outcome]; i += 1) {
          const isToday = outcome === 'open' && todayLeft > 0
          if (isToday) todayLeft -= 1
          const from = span === 'recent' ? 0 : HOURS_IN_WEEK
          const to = span === 'recent' ? HOURS_IN_WEEK : HOURS_IN_MONTH
          const hoursAgo = isToday
            ? 1 + Math.floor(rand() * 10)
            : from + 24 + Math.floor(rand() * (to - from - 24))
          issues.push({
            id: `I-${1100 + issues.length + 1}`,
            loop: loop.id,
            hoursAgo,
            outcome,
            closeHours: outcome === 'open' ? null : Math.round(lo + rand() * (hi - lo)),
          })
        }
      }
    }
  }
  return issues
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const upper = sorted[mid] ?? 0
  const lower = sorted[mid - 1] ?? upper
  return sorted.length % 2 === 1 ? upper : Math.round((lower + upper) / 2)
}

function rowOf({
  issues,
  loop,
  window,
}: {
  issues: readonly Issue[]
  loop: (typeof LOOPS)[number]
  window: WindowId
}): Row {
  const limit = window === '7d' ? HOURS_IN_WEEK : HOURS_IN_MONTH
  const mine = issues.filter((i) => i.loop === loop.id && i.hoursAgo < limit)
  const count = (outcome: Issue['outcome']) => mine.filter((i) => i.outcome === outcome).length
  const closed = mine.flatMap((i) => (i.closeHours === null ? [] : [i.closeHours]))
  return {
    id: `${loop.id}-${window}`,
    loopId: loop.id,
    loop: loop.name,
    window,
    windowLabel: WINDOW_LABEL[window],
    opened: mine.length,
    gain: loop.hasPassRecord ? count('gain') : null,
    flat: count('flat'),
    unmeasured: count('unmeasured'),
    dropped: count('dropped'),
    open: count('open'),
    medianHours: median(closed),
  }
}

/** An Issue that is still open, with the loop that filed it. */
export type OpenIssue = {
  id: string
  loopId: LoopId
  loop: string
  hoursAgo: number
  filedToday: boolean
}

export type Ledger = { rows: readonly Row[]; openIssues: readonly OpenIssue[]; filedToday: number }

/** The ledger for `?fixture=`: the rest data, or `surge` or `idle`. An unknown name is the rest data. */
export function ledgerFor(fixture: string | undefined): Ledger {
  const plan = fixture === 'surge' || fixture === 'idle' ? PLANS[fixture] : REST_PLAN
  const issues = issuesOf({ plan, seed: 85 })
  const rows = LOOPS.flatMap((loop) =>
    (['7d', '30d'] as const).map((window) => rowOf({ issues, loop, window })),
  )
  const openIssues = issues
    .filter((i) => i.outcome === 'open')
    .map((i) => ({
      id: i.id,
      loopId: i.loop,
      loop: LOOPS.find((l) => l.id === i.loop)?.name ?? i.loop,
      hoursAgo: i.hoursAgo,
      filedToday: i.hoursAgo < 24,
    }))
    .sort((a, b) => a.hoursAgo - b.hoursAgo)
  return { rows, openIssues, filedToday: openIssues.filter((i) => i.filedToday).length }
}
