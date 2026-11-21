/**
 * Issues per state for the factory owner (scenario expr-n95): a seeded, deterministic event log.
 * The factory ran its first Issue on 2 Nov 09:00 UTC; "now" is 14 minutes into the 21 Nov 00:00 hour,
 * so the last bucket of every window is partial. Every state has a peak and a time-weighted average
 * per hour; the 30-day window sums them by the day (peak: the largest hour, average: weighted by
 * minutes), and starts before the first Issue.
 */

export const STATES = ['running', 'notStarted', 'checking', 'paused'] as const
export type StateKey = (typeof STATES)[number]

export const STATE_LABEL: Record<StateKey, string> = {
  running: 'Running',
  notStarted: 'Not started',
  checking: 'Checking',
  paused: 'Paused',
}

export const WINDOWS = ['24h', '7d', '30d'] as const
export type WindowKey = (typeof WINDOWS)[number]

/** One bucket of the window: an hour (24 h, 7 d) or a UTC day (30 d). `null` is before the first Issue. */
export type Bucket = {
  /** Start of the bucket, epoch ms. */
  at: number
  /** Minutes of the bucket that have happened; under the full length only for the latest bucket. */
  minutes: number
  partial: boolean
  peak: Record<StateKey, number | null>
  avg: Record<StateKey, number | null>
}

export type Fixture = {
  name: string
  window: WindowKey
  /** The ready frame has no events at all: a fresh factory. */
  fresh: boolean
  /** An Issue count a stuck gate piles into one state, to show the capped scale. */
  pileup: boolean
}

export const FIXTURES: Record<string, Fixture> = {
  default: { name: 'default', window: '7d', fresh: false, pileup: false },
  day: { name: 'day', window: '24h', fresh: false, pileup: false },
  month: { name: 'month', window: '30d', fresh: false, pileup: false },
  pileup: { name: 'pileup', window: '7d', fresh: false, pileup: true },
  fresh: { name: 'fresh', window: '7d', fresh: true, pileup: false },
}

const HOUR = 3_600_000
const DAY = 24 * HOUR
/** The factory's first Issue, epoch ms. */
export const FIRST_ISSUE = Date.UTC(2026, 10, 2, 9)
const NOW = Date.UTC(2026, 10, 21, 0, 14)
export const PARTIAL_MINUTES = 14

type Cell = { peak: number; avg: number }
type Hour = { at: number; cells: Record<StateKey, Cell> }

/** Small seeded generator (mulberry32): the same log on every render. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const tenth = (n: number): number => Math.round(n * 10) / 10
const at = (day: number, hour: number): number => Date.UTC(2026, 10, day, hour)

/** The hours the owner remembers: a pile in the queue, one gate that held, one pause burst of 9. */
const NOTABLE: Record<string, Partial<Record<StateKey, Cell>>> = {
  [at(12, 14)]: { notStarted: { peak: 22, avg: 9.4 } },
  [at(18, 14)]: { notStarted: { peak: 13, avg: 6.1 } },
  [at(18, 15)]: { notStarted: { peak: 16, avg: 8.1 } },
  [at(17, 11)]: { paused: { peak: 9, avg: 4.8 } },
  [at(20, 11)]: { notStarted: { peak: 12, avg: 6.2 } },
}

/** Three hours a stuck gate piles into the queue: the extreme the capped scale has to hold. */
const PILEUP: Record<string, Partial<Record<StateKey, Cell>>> = {
  [at(19, 12)]: { notStarted: { peak: 41, avg: 24.5 } },
  [at(19, 13)]: { notStarted: { peak: 64, avg: 52.3 } },
  [at(19, 14)]: { notStarted: { peak: 38, avg: 30.2 } },
}

function hours(pileup: boolean): readonly Hour[] {
  const rng = seeded(95)
  const out: Hour[] = []
  for (let t = FIRST_ISSUE; t <= NOW; t += HOUR) {
    const clock = new Date(t).getUTCHours()
    const weekday = new Date(t).getUTCDay()
    const work = clock >= 7 && clock <= 19 && weekday !== 0 && weekday !== 6 ? 1 : 0
    const running = tenth(3 + 2.5 * work + rng() * 1.2)
    const queue = tenth(1.8 + 3.2 * work + rng() * 1.5)
    const checking = tenth(1.2 + 1.6 * work + rng())
    const idle = rng() < 0.3
    const paused = idle ? 0 : tenth(0.3 + rng() * 0.5)
    const cells: Record<StateKey, Cell> = {
      running: { avg: running, peak: Math.ceil(running + rng() * 1.6) },
      notStarted: { avg: queue, peak: Math.ceil(queue + rng() * 2.2) },
      checking: { avg: checking, peak: Math.ceil(checking + rng() * 1.2) },
      paused: { avg: paused, peak: paused === 0 ? 0 : 1 },
    }
    const notable = { ...NOTABLE[t], ...(pileup ? PILEUP[t] : undefined) }
    out.push({ at: t, cells: { ...cells, ...notable } })
  }
  return out
}

const EMPTY: Record<StateKey, number | null> = {
  running: null,
  notStarted: null,
  checking: null,
  paused: null,
}

/** Merges the hours of one bucket: the largest peak, and the average weighted by minutes. */
function merge(start: number, step: number, members: readonly Hour[]): Bucket {
  const length = step / 60_000
  const minutes = Math.min(length, Math.round((NOW - start) / 60_000))
  const partial = minutes < length
  if (members.length === 0) return { at: start, minutes, partial, peak: EMPTY, avg: EMPTY }
  const peak = { ...EMPTY }
  const avg = { ...EMPTY }
  for (const state of STATES) {
    let top = 0
    let sum = 0
    let weight = 0
    for (const h of members) {
      const w = Math.min(HOUR, NOW - h.at)
      top = Math.max(top, h.cells[state].peak)
      sum += h.cells[state].avg * w
      weight += w
    }
    peak[state] = top
    avg[state] = tenth(sum / weight)
  }
  return { at: start, minutes, partial, peak, avg }
}

/** The buckets of a window ending at the latest one: 24 or 168 hours, or 30 days. */
export function bucketsOf(window: WindowKey, pileup: boolean): readonly Bucket[] {
  const log = hours(pileup)
  const step = window === '30d' ? DAY : HOUR
  const count = window === '24h' ? 24 : window === '7d' ? 168 : 30
  const last = Math.floor(NOW / step) * step
  return Array.from({ length: count }, (_, i) => {
    const start = last - (count - 1 - i) * step
    return merge(
      start,
      step,
      log.filter((h) => h.at >= start && h.at < start + step),
    )
  })
}

/** The buckets a fixture shows: a fresh factory has the window's buckets and no event in any. */
export function bucketsFor(window: WindowKey, fixture: Fixture): readonly Bucket[] {
  const buckets = bucketsOf(window, fixture.pileup)
  if (!fixture.fresh) return buckets
  return buckets.map((b) => ({ ...b, peak: EMPTY, avg: EMPTY }))
}

/** The scale stops here; a larger peak is drawn on the edge with the kit's off-scale caret. */
export const CAP = 30

export type StateSummary = { peak: number; peakAt: number; mean: number }

export type Summary = {
  perState: Record<StateKey, StateSummary>
  /** The state and bucket with the highest peak of the window. */
  worst: { state: StateKey } & StateSummary
  /** Buckets of the worst state whose peak reached half of the worst peak, and every bucket with data. */
  near: number
  total: number
  /** The first bucket with data, or null when the window holds no event. */
  firstAt: number | null
  /** The top of the shared scale. */
  ceil: number
}

/** The numbers the page reads, derived once from the buckets: null when no bucket holds an event. */
export function summarize(buckets: readonly Bucket[]): Summary | null {
  const real = buckets.filter((b) => b.peak.running !== null)
  const first = real[0]
  if (first === undefined) return null
  const of = (state: StateKey): StateSummary => {
    let peak = -1
    let peakAt = first.at
    let sum = 0
    let weight = 0
    for (const b of real) {
      const p = b.peak[state] ?? 0
      if (p > peak) {
        peak = p
        peakAt = b.at
      }
      sum += (b.avg[state] ?? 0) * b.minutes
      weight += b.minutes
    }
    return { peak, peakAt, mean: tenth(sum / weight) }
  }
  const perState = {
    running: of('running'),
    notStarted: of('notStarted'),
    checking: of('checking'),
    paused: of('paused'),
  }
  const state = STATES.reduce((best, s) => (perState[s].peak > perState[best].peak ? s : best))
  const worst = { state, ...perState[state] }
  const near = real.filter((b) => (b.peak[state] ?? 0) * 2 >= worst.peak).length
  const ceil = Math.ceil(Math.min(worst.peak, CAP) / 5) * 5
  return { perState, worst, near, total: real.length, firstAt: first.at, ceil }
}
