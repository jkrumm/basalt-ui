/**
 * One month of line speed tests: a download and an upload test every 30 minutes for 30 days, the
 * contract for each direction, a few days with no tests and one week mostly under the normal
 * speed. Seeded, so every build draws the same month.
 *
 * Fixtures: `rest` (default: a slow week, an outage day with a zero median), `burst` (one day's
 * median far over the contracted maximum) and `clean` (no day under the minimum).
 */
import { createFormat } from 'basalt-ui'

export type Direction = 'down' | 'up'
export type Contract = { readonly max: number; readonly normal: number; readonly min: number }

/** Mbit/s, as the provider's contract states them. */
export const CONTRACT: Record<Direction, Contract> = {
  down: { max: 250, normal: 200, min: 100 },
  up: { max: 50, normal: 40, min: 20 },
}

export const TESTS_PER_DAY = 48

export const VERDICTS = [
  'Download below min',
  'Upload below min',
  'Both below min',
  'Under normal',
  'Meets normal',
  'No tests',
] as const
export type Verdict = (typeof VERDICTS)[number]

export type Day = {
  id: string
  /** Midnight UTC, epoch ms. */
  at: number
  /** The day's one name on the axis, the list and the readout: `Apr 3`. */
  label: string
  tests: number
  /** The median test of the day, Mbit/s; `null` on a day with no tests. */
  down: number | null
  up: number | null
  /** The slowest single test of the day. */
  downWorst: number | null
  upWorst: number | null
  verdict: Verdict
}

export type Month = {
  days: readonly Day[]
  tests: number
  /** The median of every test of the month. */
  median: Record<Direction, number | null>
}

const YEAR = 2026
const APRIL = 3
const DAYS = 30
const BASE: Record<Direction, number> = { down: 226, up: 44 }
const NO_TESTS: readonly number[] = [6, 7, 26]
const OUTAGE_DAY = 9
const BURST_DAY = 24
/** Day of month to the share of the usual speed each direction held that day. */
const SLOW_WEEK: Record<number, readonly [number, number]> = {
  16: [0.62, 0.7],
  17: [0.52, 0.6],
  18: [0.42, 0.5],
  19: [0.5, 0.46],
  20: [0.4, 0.44],
  21: [0.47, 0.58],
  22: [0.64, 0.7],
}

const FORMAT = createFormat()

/** mulberry32: a small seeded generator, so the fixture never changes between builds. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const upper = sorted[mid] ?? 0
  const lower = sorted[mid - 1] ?? upper
  const mid1 = sorted.length % 2 === 0 ? (lower + upper) / 2 : upper
  return Math.round(mid1 * 10) / 10
}

function verdictOf(down: number | null, up: number | null): Verdict {
  if (down === null || up === null) return 'No tests'
  const downLow = down < CONTRACT.down.min
  const upLow = up < CONTRACT.up.min
  if (downLow && upLow) return 'Both below min'
  if (downLow) return 'Download below min'
  if (upLow) return 'Upload below min'
  if (down < CONTRACT.down.normal || up < CONTRACT.up.normal) return 'Under normal'
  return 'Meets normal'
}

type Series = Record<Direction, number[]>

/** One day's tests, a test every 30 minutes; the evening is slower than the night. */
function testsOf(day: number, rand: () => number, name: string): Series {
  const [slowDown, slowUp] = name === 'clean' ? [1, 1] : (SLOW_WEEK[day] ?? [1, 1])
  const out: Series = { down: [], up: [] }
  for (let slot = 0; slot < TESTS_PER_DAY; slot += 1) {
    const hour = slot / 2
    const evening = hour >= 19 && hour < 23 ? 0.88 : hour < 6 ? 1.03 : 1
    const outage = name === 'rest' && day === OUTAGE_DAY && slot >= 6 && slot < 36
    const burst = name === 'burst' && day === BURST_DAY ? 3.1 : 1
    const speed = (direction: Direction, held: number): number => {
      if (outage) return 0
      const noise = 1 + (rand() - 0.5) * 0.12
      const raw = BASE[direction] * held * evening * noise * burst
      return Math.round(Math.min(raw, CONTRACT[direction].max * burst) * 10) / 10
    }
    out.down.push(speed('down', slowDown))
    out.up.push(speed('up', slowUp))
  }
  return out
}

export function buildMonth(fixture: string | undefined): Month {
  const name = fixture === 'burst' || fixture === 'clean' ? fixture : 'rest'
  const rand = seeded(4601)
  const all: Series = { down: [], up: [] }
  const days: Day[] = []
  for (let n = 1; n <= DAYS; n += 1) {
    const at = Date.UTC(YEAR, APRIL, n)
    const base = {
      id: new Date(at).toISOString().slice(0, 10),
      at,
      label: FORMAT.date(at, 'short', { year: undefined }),
    }
    if (NO_TESTS.includes(n)) {
      days.push({
        ...base,
        tests: 0,
        down: null,
        up: null,
        downWorst: null,
        upWorst: null,
        verdict: 'No tests',
      })
      continue
    }
    const tests = testsOf(n, rand, name)
    all.down.push(...tests.down)
    all.up.push(...tests.up)
    const down = median(tests.down)
    const up = median(tests.up)
    days.push({
      ...base,
      tests: tests.down.length,
      down,
      up,
      downWorst: Math.min(...tests.down),
      upWorst: Math.min(...tests.up),
      verdict: verdictOf(down, up),
    })
  }
  return {
    days,
    tests: all.down.length,
    median: { down: median(all.down), up: median(all.up) },
  }
}

/** Days with tests whose median in `direction` is under `limit`. */
export function daysUnder(days: readonly Day[], direction: Direction, limit: number): number {
  return days.filter((d) => d[direction] !== null && (d[direction] ?? 0) < limit).length
}

/** Runs of neighbouring days that match, as first and last day, in time order. */
export function runs(
  days: readonly Day[],
  match: (d: Day) => boolean,
): { from: Day; to: Day; length: number }[] {
  const out: { from: Day; to: Day; length: number }[] = []
  let open: { from: Day; to: Day; length: number } | null = null
  for (const d of days) {
    if (!match(d)) {
      open = null
      continue
    }
    if (open === null) {
      open = { from: d, to: d, length: 1 }
      out.push(open)
      continue
    }
    open.to = d
    open.length += 1
  }
  return out
}
