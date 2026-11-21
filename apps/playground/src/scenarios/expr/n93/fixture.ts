import type { CalendarDate } from 'basalt-ui'

/** One day of the watch export. A `null` field is a reading the watch never took, never a zero. */
export type Day = {
  date: CalendarDate
  vigorous: number | null
  moderate: number | null
  steps: number | null
  score: number | null
}

export type Fixture = { name: 'ninety' | 'short'; days: readonly Day[] }

/** Seeded generator, so every build draws the same ninety days. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const LAST = Date.UTC(2026, 10, 19)
const DAY_MS = 86_400_000

export const isCalendarDate = (s: string): s is CalendarDate => /^\d{4}-\d{2}-\d{2}$/.test(s)

function calendarDate(ms: number): CalendarDate {
  const iso = new Date(ms).toISOString().slice(0, 10)
  if (!isCalendarDate(iso)) throw new Error(`Not a calendar date: ${iso}`)
  return iso
}

/** How a day's score follows its minutes and steps. */
const scoreOf = (vigorous: number, moderate: number, steps: number): number =>
  Math.min(100, Math.round(vigorous * 1.4 + moderate * 0.45 + steps / 450))

type Shape = {
  count: number
  seed: number
  /** Indexes of days the watch took no reading on (a device reset). */
  gap: readonly number[]
  /** The day with steps and minutes but no score. */
  noScore: number
  /** The day with about four hours of vigorous minutes. */
  extreme: number | null
  /** Days that are a real zero of vigorous minutes. */
  rest: readonly number[]
}

function build(shape: Shape): Day[] {
  const rand = seeded(shape.seed)
  return Array.from({ length: shape.count }, (_, i) => {
    const date = calendarDate(LAST - (shape.count - 1 - i) * DAY_MS)
    const ramp = i / (shape.count - 1)
    const wobble = (): number => rand() - 0.5
    let vigorous = Math.round(14 + ramp * 9 + wobble() * 12)
    let moderate = Math.round(34 + ramp * 16 + wobble() * 24)
    let steps = Math.round(5600 + ramp * 3800 + wobble() * 3000)
    if (shape.rest.includes(i)) {
      vigorous = 0
      moderate = 9
      steps = 2310
    }
    if (i === shape.extreme) {
      vigorous = 238
      moderate = 31
      steps = 21_480
    }
    if (shape.gap.includes(i)) {
      return { date, vigorous: null, moderate: null, steps: null, score: null }
    }
    const score = i === shape.noScore ? null : scoreOf(vigorous, moderate, steps)
    return { date, vigorous, moderate, steps, score }
  })
}

const NINETY: Shape = {
  count: 90,
  seed: 93,
  gap: [61, 62, 63],
  noScore: 74,
  extreme: 47,
  rest: [33, 40],
}

/** Two weeks in which every day has a reading: the gap count is a measured zero. */
const SHORT: Shape = { count: 14, seed: 14, gap: [], noScore: 9, extreme: null, rest: [4] }

/** `?fixture=short` is the fortnight; any other value is the ninety days. */
export function fixtureOf(name: string | undefined): Fixture {
  if (name === 'short') return { name: 'short', days: build(SHORT) }
  return { name: 'ninety', days: build(NINETY) }
}
