/**
 * Photo library for scenario expr-n97: every period of the window with its shots, the decisions made
 * (kept, rejected) and the shots still unrated, plus the photos that carry no capture time. Seeded,
 * so every build draws the same library. The default is 12 months by month; `days` is 30 days by day;
 * `clear` is the monthly library with no undated photo.
 */
import type { CalendarDate } from 'basalt-ui'

export type Period = {
  /** The first day of a month, or the day itself: a `CalendarDate`. */
  at: CalendarDate
  shots: number
  kept: number
  rejected: number
  /** Kept plus rejected. */
  rated: number
  /** Shots with no decision yet. */
  unrated: number
  /** The period is not over yet: its counts are so far. */
  partial: boolean
}

export type Library = {
  grain: 'month' | 'day'
  periods: readonly Period[]
  /** Photos with no capture time: in no period. */
  undated: number
  /** The same photos in the window before this one. */
  priorUndated: number
  /** How far the partial period has got, as a caption value. */
  partialNote: string
}

/** A small seeded generator (mulberry32): the same seed draws the same library on every build. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Draw = { shots: number; rated: number; partial: boolean }

function period(at: CalendarDate, { shots, rated, partial }: Draw, keptShare: number): Period {
  const kept = Math.round(rated * keptShare)
  return { at, shots, kept, rejected: rated - kept, rated, unrated: shots - rated, partial }
}

const MONTHS: readonly CalendarDate[] = [
  '2025-12-01',
  '2026-01-01',
  '2026-02-01',
  '2026-03-01',
  '2026-04-01',
  '2026-05-01',
  '2026-06-01',
  '2026-07-01',
  '2026-08-01',
  '2026-09-01',
  '2026-10-01',
  '2026-11-01',
]

/** The burst: 400 shots over three months with 20 decisions, the last of them with none at all. */
const MONTH_BURST: Readonly<Record<string, Draw>> = {
  '2026-06-01': { shots: 160, rated: 12, partial: false },
  '2026-07-01': { shots: 130, rated: 8, partial: false },
  '2026-08-01': { shots: 110, rated: 0, partial: false },
}

function byMonth(): Period[] {
  const next = seeded(97)
  return MONTHS.map((at) => {
    const keptShare = 0.36 + next() * 0.16
    const burst = MONTH_BURST[at]
    if (burst !== undefined) return period(at, burst, 0.4)
    if (at === '2026-11-01') return period(at, { shots: 118, rated: 96, partial: true }, keptShare)
    const shots = 260 + Math.floor(next() * 90)
    const rated = Math.round(shots * (0.88 + next() * 0.09))
    return period(at, { shots, rated, partial: false }, keptShare)
  })
}

const DAYS: readonly CalendarDate[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 9, 23 + i))
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` as CalendarDate
})

const DAY_BURST: Readonly<Record<string, Draw>> = {
  '2026-11-09': { shots: 140, rated: 12, partial: false },
  '2026-11-10': { shots: 134, rated: 8, partial: false },
  '2026-11-11': { shots: 126, rated: 0, partial: false },
}

function byDay(): Period[] {
  const next = seeded(9797)
  return DAYS.map((at) => {
    const keptShare = 0.36 + next() * 0.16
    const burst = DAY_BURST[at]
    if (burst !== undefined) return period(at, burst, 0.4)
    if (at === DAYS.at(-1)) return period(at, { shots: 58, rated: 41, partial: true }, keptShare)
    const shots = 84 + Math.floor(next() * 32)
    const rated = Math.round(shots * (0.86 + next() * 0.1))
    return period(at, { shots, rated, partial: false }, keptShare)
  })
}

/** The library a `?fixture=` name asks for; an unknown or absent name is the monthly default. */
export function libraryOf(fixture: string | undefined): Library {
  if (fixture === 'days')
    return {
      grain: 'day',
      periods: byDay(),
      undated: 180,
      priorUndated: 0,
      partialNote: 'Nov 21, today',
    }
  return {
    grain: 'month',
    periods: byMonth(),
    undated: fixture === 'clear' ? 0 : 180,
    priorUndated: 0,
    partialNote: 'Nov, day 21 of 30',
  }
}

export type Run = {
  /** The periods of the run, in order. */
  periods: readonly Period[]
  shots: number
  unrated: number
  /** What the same number of usual periods leave unrated. */
  usual: number
}

/**
 * The run of consecutive periods that fell furthest behind: a period is behind when it leaves more
 * than three times the usual unrated (the median of the complete periods), and the run with the
 * most unrated shots wins. `null` when no period is behind.
 */
export function furthestBehind(periods: readonly Period[]): Run | null {
  const complete = periods.filter((p) => !p.partial).map((p) => p.unrated)
  const sorted = [...complete].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0
  let best: Period[] = []
  let current: Period[] = []
  const sum = (run: readonly Period[]): number => run.reduce((total, p) => total + p.unrated, 0)
  for (const p of periods) {
    if (p.unrated > 3 * median) current.push(p)
    else current = []
    if (sum(current) > sum(best)) best = [...current]
  }
  if (best.length === 0) return null
  return {
    periods: best,
    shots: best.reduce((total, p) => total + p.shots, 0),
    unrated: sum(best),
    usual: median * best.length,
  }
}
