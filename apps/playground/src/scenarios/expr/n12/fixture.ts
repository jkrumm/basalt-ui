/** Seeded, deterministic sleep fixture: 30 nights of stage minutes plus bedtime and wake time. */

export const STAGES = ['deep', 'light', 'rem', 'awake'] as const
export type Stage = (typeof STAGES)[number]

export type Night = {
  /** The morning the night ended, UTC midnight. */
  date: Date
  bed: Date
  wake: Date
  deep: number | null
  light: number | null
  rem: number | null
  awake: number | null
  /** Deep + light + REM, or null while a stage is missing. */
  asleep: number | null
  /** Minutes of the stages that were recorded. */
  partial: number
  last: boolean
}

/** Minutes asleep that count as enough. */
export const NEED_MIN = 420
/** A stage this far under its usual counts as short. */
export const SHORT_RATIO = 0.9

const NIGHTS = 30
const LAST_MORNING = Date.UTC(2026, 10, 16)
const DAY_MS = 86_400_000
const MIN_MS = 60_000

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Minutes = Record<Stage, number | null>

/** Last night per fixture: the default is a short deep stage. */
const LAST: Record<string, Minutes> = {
  default: { deep: 41, light: 238, rem: 99, awake: 27 },
  'missing-rem': { deep: 74, light: 231, rem: null, awake: 29 },
  'zero-deep': { deep: 0, light: 262, rem: 101, awake: 24 },
  restless: { deep: 82, light: 410, rem: 108, awake: 196 },
}

export function buildNights(fixture: string | undefined): readonly Night[] {
  const rand = mulberry32(1212)
  const around = (mean: number, spread: number) => Math.round(mean + (rand() * 2 - 1) * spread)
  const lastMinutes = LAST[fixture ?? ''] ?? LAST['default']!
  return Array.from({ length: NIGHTS }, (_, i) => {
    const last = i === NIGHTS - 1
    const minutes: Minutes = last
      ? lastMinutes
      : {
          deep: around(78, 14),
          light: around(236, 22),
          rem: around(98, 14),
          awake: around(28, 9),
        }
    const { deep, light, rem, awake } = minutes
    const asleep = deep === null || light === null || rem === null ? null : deep + light + rem
    const partial = (deep ?? 0) + (light ?? 0) + (rem ?? 0)
    const date = new Date(LAST_MORNING - (NIGHTS - 1 - i) * DAY_MS)
    const wake = new Date(date.getTime() + (6 * 60 + around(25, 25)) * MIN_MS)
    const inBed = (deep ?? 0) + (light ?? 0) + (rem ?? 0) + (awake ?? 0)
    const bed = new Date(wake.getTime() - inBed * MIN_MS)
    return { date, bed, wake, deep, light, rem, awake, asleep, partial, last }
  })
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = values.toSorted((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2
}

/** The median of the nights before the last one: the reader's usual. */
export function usualOf(
  nights: readonly Night[],
  pick: (n: Night) => number | null,
): number | null {
  const values = nights
    .filter((n) => !n.last)
    .map(pick)
    .filter((v): v is number => v !== null)
  const m = median(values)
  return m === null ? null : Math.round(m)
}

/** Stage minutes below SHORT_RATIO of usual, as a share short of it; the furthest first. */
export function shortStages(last: Night, nights: readonly Night[]): readonly Stage[] {
  return STAGES.filter((s) => s !== 'awake')
    .map((s) => {
      const value = last[s]
      const usual = usualOf(nights, (n) => n[s])
      return { s, gap: value === null || usual === null || usual === 0 ? 0 : 1 - value / usual }
    })
    .filter((r) => r.gap > 1 - SHORT_RATIO)
    .toSorted((a, b) => b.gap - a.gap)
    .map((r) => r.s)
}
