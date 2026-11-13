/**
 * c04 fixture: 300 agent run durations in seconds against a 120 s timeout, seeded and pinned to a
 * fixed window. A run that hits the timeout is recorded at exactly the timeout, so it is counted
 * apart from the finished runs, never binned with them.
 */
import { fmtDay, seeded } from '../../fixture-utils'

export const TIMEOUT_S = 120
export const BIN_S = 10
const RUN_COUNT = 300
const SEED = 2026
const DAY_MS = 86_400_000

/** The pinned "now": no render reads the clock. */
export const WINDOW_END = new Date(Date.UTC(2026, 10, 12))
export const WINDOW_START = new Date(WINDOW_END.getTime() - 6 * DAY_MS)
export const WINDOW_LABEL = `${fmtDay(WINDOW_START)} – ${fmtDay(WINDOW_END)}`

export type Run = { id: string; seconds: number }

/** Two instant failures (the agent never started) plus a fast core and a slow tail, capped at the timeout. */
export const RUNS: readonly Run[] = (() => {
  const rand = seeded(SEED)
  const normal = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand())
  const seconds = [0.4, 0.9]
  while (seconds.length < RUN_COUNT) {
    const slow = rand() < 0.13
    const median = slow ? 85 : 28
    const sigma = slow ? 0.45 : 0.5
    const raw = Math.exp(Math.log(median) + sigma * normal())
    seconds.push(Math.min(TIMEOUT_S, Math.round(raw * 10) / 10))
  }
  return seconds.map((s, i) => ({ id: `run-${String(i + 1).padStart(3, '0')}`, seconds: s }))
})()

// cycle-expression-1: the kit ships no quantile or percentile helper, so the median and p95 are hand-written.
/** Linear-interpolated quantile of an ascending list; `NaN` for an empty one. */
function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return Number.NaN
  const at = (sorted.length - 1) * q
  const lo = Math.floor(at)
  const hi = Math.ceil(at)
  const a = sorted[lo] ?? Number.NaN
  const b = sorted[hi] ?? Number.NaN
  return a + (b - a) * (at - lo)
}

export type Summary = {
  count: number
  median: number
  p95: number
  timeouts: number
  /** Share of all runs, 0–1. */
  timeoutShare: number
}

export function summarize(runs: readonly Run[]): Summary {
  const sorted = runs.map((r) => r.seconds).toSorted((a, b) => a - b)
  const timeouts = sorted.filter((s) => s >= TIMEOUT_S).length
  return {
    count: sorted.length,
    median: quantile(sorted, 0.5),
    p95: quantile(sorted, 0.95),
    timeouts,
    timeoutShare: sorted.length === 0 ? 0 : timeouts / sorted.length,
  }
}

export type Bin = {
  /** The band's edges and centre on the seconds axis; the timeout bar sits just right of the limit. */
  from: number
  to: number
  x: number
  /** The tooltip title. */
  title: string
  /** Finished runs in the band; `null` on the timeout bar. */
  finished: number | null
  /** Runs cut off at the timeout; `null` on every finished band. */
  timedOut: number | null
  /** Share of all runs that ended at or before this bar, 0–1. */
  cumulative: number
}

// cycle-expression-1: the kit has no histogram kind, so the binning and the extra timeout bar are hand-built.
/** The finished bands [0,10) … [110,120), then one bar for the runs that hit the timeout. */
export function bin(runs: readonly Run[]): Bin[] {
  const total = runs.length
  const bands = TIMEOUT_S / BIN_S
  const counts = Array.from({ length: bands }, () => 0)
  let timedOut = 0
  for (const { seconds } of runs) {
    if (seconds >= TIMEOUT_S) timedOut += 1
    else counts[Math.floor(seconds / BIN_S)] = (counts[Math.floor(seconds / BIN_S)] ?? 0) + 1
  }
  let running = 0
  const share = (n: number): number => (total === 0 ? 0 : n / total)
  const rows: Bin[] = counts.map((count, i) => {
    running += count
    const range = `${i * BIN_S}–${(i + 1) * BIN_S}`
    return {
      from: i * BIN_S,
      to: (i + 1) * BIN_S,
      x: i * BIN_S + BIN_S / 2,
      title: `${range} s`,
      finished: count,
      timedOut: null,
      cumulative: share(running),
    }
  })
  rows.push({
    from: TIMEOUT_S,
    to: TIMEOUT_S + BIN_S,
    x: TIMEOUT_S + BIN_S / 2,
    title: `Hit the ${TIMEOUT_S} s timeout`,
    finished: null,
    timedOut,
    cumulative: share(running + timedOut),
  })
  return rows
}
