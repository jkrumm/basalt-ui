/** Seeded training log for expr-n03: nine Monday-to-Sunday weeks of daily load in AU (session RPE x minutes). */
import { createFormat } from 'basalt-ui'
import type { CalendarDate } from 'basalt-ui'

const fmt = createFormat()

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export type DayName = (typeof DAY_NAMES)[number]

/** The weekly target band, in AU. */
export const BAND = { from: 2400, to: 3200 } as const

export type Day = {
  week: string
  day: DayName
  load: number
  /** `done` is logged; `planned` is still ahead in the current week. */
  state: 'done' | 'planned'
  session: string
}

export type Week = {
  /** Short Monday date, the band key of the weekly chart. */
  label: string
  current: boolean
  done: number
  planned: number
  total: number
}

export type TrainingLog = { days: readonly Day[]; weeks: readonly Week[] }

const WEEK_STARTS: readonly CalendarDate[] = [
  '2026-09-14',
  '2026-09-21',
  '2026-09-28',
  '2026-10-05',
  '2026-10-12',
  '2026-10-19',
  '2026-10-26',
  '2026-11-02',
  '2026-11-09',
]

/** Week totals of the eight past weeks: a deload under the band (week 4) and a spike over it (week 7). */
const PAST_TOTALS = [2580, 2760, 2950, 2310, 2870, 3050, 3420, 2740] as const

/** How a week's load spreads over Monday to Sunday; Friday is the rest day. */
const SHAPE = [0.12, 0.18, 0.14, 0.2, 0, 0.24, 0.12] as const

const SESSIONS = [
  'Intervals',
  'Tempo run',
  'Recovery spin',
  'Strength',
  'Rest',
  'Long ride',
  'Easy run',
]

/** mulberry32: a deterministic stream, so every build draws the same log. */
function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pastDays(label: string, total: number, rand: () => number): Day[] {
  const loads = SHAPE.map((share) => Math.round(total * share * (0.85 + rand() * 0.3)))
  const saturday = 5
  loads[saturday] = 0
  loads[saturday] = total - loads.reduce((sum, load) => sum + load, 0)
  return DAY_NAMES.map((day, i) => ({
    week: label,
    day,
    load: loads[i] ?? 0,
    state: 'done',
    session: SESSIONS[i] ?? '',
  }))
}

/** This week: Monday to Thursday logged, Friday to Sunday planned. */
function currentDays(label: string, planned: readonly number[], done: readonly number[]): Day[] {
  return DAY_NAMES.map((day, i) => ({
    week: label,
    day,
    load: (i < done.length ? done[i] : planned[i - done.length]) ?? 0,
    state: i < done.length ? 'done' : 'planned',
    session: SESSIONS[i] ?? '',
  }))
}

function weeksOf(days: readonly Day[]): Week[] {
  return WEEK_STARTS.map((start, i) => {
    const label = fmt.date(start, 'short')
    const mine = days.filter((d) => d.week === label)
    const done = mine.filter((d) => d.state === 'done').reduce((sum, d) => sum + d.load, 0)
    const planned = mine.filter((d) => d.state === 'planned').reduce((sum, d) => sum + d.load, 0)
    return { label, current: i === WEEK_STARTS.length - 1, done, planned, total: done + planned }
  })
}

/**
 * `over` is the extreme: a 1,800 AU long ride and a hard Sunday push the week 890 over the band.
 * `zero` is a rest week: nothing logged and nothing planned.
 */
export function trainingLog(fixture: string | undefined): TrainingLog {
  const rand = seeded(2611)
  const past = PAST_TOTALS.flatMap((total, i) =>
    pastDays(fmt.date(WEEK_STARTS[i] ?? '2026-09-14', 'short'), total, rand),
  )
  const label = fmt.date(WEEK_STARTS[WEEK_STARTS.length - 1] ?? '2026-11-09', 'short')
  const days = [
    ...past,
    ...(fixture === 'over'
      ? currentDays(label, [0, 1800, 700], [360, 540, 280, 410])
      : fixture === 'zero'
        ? currentDays(label, [0, 0, 0], [0, 0, 0, 0])
        : currentDays(label, [0, 900, 460], [360, 540, 280, 410])),
  ]
  return { days, weeks: weeksOf(days) }
}
