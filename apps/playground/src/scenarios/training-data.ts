/**
 * S2 fixture data: ~200 days of training sessions (strength, walking pad, mobility) shaped like
 * argo's strength-tracker and walking-pad. Deterministic — a seeded generator run once at module
 * load, so a re-render, a reload and a screenshot all read the same numbers. Every period label is
 * derived from `TODAY`, so moving the reading date moves the copy with it.
 */

import { fmtDay, itemAt, monthName, seeded, timedPoints, zoneFor } from './fixture-utils'

const SESSION_TYPES = ['strength', 'walk', 'mobility'] as const
export type SessionType = (typeof SESSION_TYPES)[number]

const TYPE_LABEL: Record<SessionType, string> = {
  strength: 'Strength',
  walk: 'Walking pad',
  mobility: 'Mobility',
}

/** The reading date. Fixed, so the month-to-date window never moves under a screenshot. */
const TODAY = new Date(Date.UTC(2026, 9, 16))
/** The reading date as a `Date`, for the log's relative labels. */
export const READING_DATE = TODAY
const DAY_MS = 86_400_000
const WINDOW_DAYS = 200
/** Months a goal hit rate is read over: the six complete months before the current one. */
export const HIT_MONTHS = 6

const YEAR = TODAY.getUTCFullYear()
const month = TODAY.getUTCMonth()
const priorMonthStart = new Date(Date.UTC(YEAR, month - 1, 1))

/** `16 Oct` — the reading date as a label. */
export const TODAY_LABEL = fmtDay(TODAY)
export const DAYS_ELAPSED = TODAY.getUTCDate()
export const MONTH_DAYS = new Date(Date.UTC(YEAR, month + 1, 0)).getUTCDate()
/** `31 Oct` — the last day of the month, where the goal is due. */
export const MONTH_END_LABEL = fmtDay(new Date(Date.UTC(YEAR, month + 1, 0)))
export const MONTH_NAME = monthName(TODAY, 'long')
/** `1–16 Oct` — the month-to-date window, and `1–16 Sep` the same days a month earlier. */
export const WINDOW_LABEL = `1–${DAYS_ELAPSED} ${monthName(TODAY, 'short')}`
export const PRIOR_WINDOW_LABEL = `1–${DAYS_ELAPSED} ${monthName(priorMonthStart, 'short')}`
/** `Apr–Sep` — the months the hit rate reads over. */
export const HIT_RANGE_LABEL = `${monthName(new Date(Date.UTC(YEAR, month - HIT_MONTHS, 1)), 'short')}–${monthName(priorMonthStart, 'short')}`

/** Sessions per month the plan asks for. */
export const GOAL_SESSIONS = 28

type Lift = { name: string; sets: number; reps: number; kg: number; volumeKg: number }
type Session = {
  date: Date
  type: SessionType
  /** Training load in arbitrary units: minutes × session intensity (1–10). */
  load: number
  volumeKg: number
  km: number
  lifts: readonly Lift[]
}

/** Working weight in kg at the start of the window, sets and reps per lift. */
const LIFTS = [
  { name: 'Squat', kg: 100, sets: 4, reps: 5 },
  { name: 'Deadlift', kg: 120, sets: 3, reps: 5 },
  { name: 'Bench press', kg: 80, sets: 4, reps: 6 },
  { name: 'Overhead press', kg: 50, sets: 4, reps: 6 },
  { name: 'Barbell row', kg: 70, sets: 4, reps: 8 },
  { name: 'Pull-up', kg: 80, sets: 4, reps: 6 },
  { name: 'Romanian deadlift', kg: 90, sets: 3, reps: 8 },
  { name: 'Leg press', kg: 180, sets: 3, reps: 10 },
] as const
const LIFTS_PER_SESSION = 4
/** Chance of each session type on a day: strength by weekday, walking pad and mobility daily. */
const STRENGTH_CHANCE_BY_WEEKDAY = [0.05, 0.6, 0.05, 0.6, 0.05, 0.6, 0.25] // Sun … Sat
const WALK_CHANCE = 0.5
const MOBILITY_CHANCE = 0.15

const random = seeded(2026_10_12)
const windowStart = TODAY.getTime() - (WINDOW_DAYS - 1) * DAY_MS
/** A random in [lo, hi). */
const between = (lo: number, hi: number): number => lo + random() * (hi - lo)

const strengthSession = (date: Date, progress: number): Session => {
  const minutes = between(50, 75)
  const first = Math.floor(random() * LIFTS.length)
  const lifts = Array.from({ length: LIFTS_PER_SESSION }, (_, k) => {
    const lift = itemAt(LIFTS, (first + k) % LIFTS.length)
    const kg = Math.round((lift.kg * (0.92 + progress * 0.12) * between(0.97, 1.03)) / 2.5) * 2.5
    return {
      name: lift.name,
      sets: lift.sets,
      reps: lift.reps,
      kg,
      volumeKg: kg * lift.sets * lift.reps,
    }
  })
  return {
    date,
    type: 'strength',
    load: minutes * between(5.5, 8),
    volumeKg: lifts.reduce((a, l) => a + l.volumeKg, 0),
    km: 0,
    lifts,
  }
}

const SESSIONS: readonly Session[] = Array.from({ length: WINDOW_DAYS }, (_, i) => {
  const date = new Date(windowStart + i * DAY_MS)
  const progress = i / WINDOW_DAYS
  const day = date.getUTCDay()
  const strengthChance = itemAt(STRENGTH_CHANCE_BY_WEEKDAY, day)
  const sessions: Session[] = []
  if (random() < strengthChance) sessions.push(strengthSession(date, progress))
  if (random() < WALK_CHANCE) {
    const minutes = between(20, 50)
    sessions.push({
      date,
      type: 'walk',
      load: minutes * between(2, 3),
      volumeKg: 0,
      km: minutes * between(0.07, 0.1),
      lifts: [],
    })
  }
  if (random() < MOBILITY_CHANCE) {
    sessions.push({
      date,
      type: 'mobility',
      load: between(15, 30) * between(1.5, 2),
      volumeKg: 0,
      km: 0,
      lifts: [],
    })
  }
  return sessions
}).flat()

export type SessionResult = 'PR' | 'Held' | 'Dropped'

export type SessionLogRow = {
  date: Date
  exercise: string
  sets: number
  volumeKg: number
  e1rmKg: number
  result: SessionResult
}

/** Epley: the load that one rep would match. */
const estimatedOneRepMax = (kg: number, reps: number): number => Math.round(kg * (1 + reps / 30))

/**
 * The strength log, newest first: every lift of every strength session in the month-to-date window.
 * It is the data: "Top lifts by volume" sums these rows and the session mix counts its distinct days,
 * so the three cannot disagree. A lift's result compares its top set with the previous session's.
 */
const resultOf = (kg: number, previousKg: number | undefined): SessionResult =>
  previousKg === undefined || kg === previousKg ? 'Held' : kg > previousKg ? 'PR' : 'Dropped'

export const SESSION_LOG: readonly SessionLogRow[] = (() => {
  const lastKg = new Map<string, number>()
  const rows: SessionLogRow[] = []
  for (const s of SESSIONS) {
    for (const l of s.lifts) {
      const inWindow = s.date.getUTCFullYear() === YEAR && s.date.getUTCMonth() === month
      if (inWindow) {
        rows.push({
          date: s.date,
          exercise: l.name,
          sets: l.sets,
          volumeKg: l.volumeKg,
          e1rmKg: estimatedOneRepMax(l.kg, l.reps),
          result: resultOf(l.kg, lastKg.get(l.name)),
        })
      }
      lastKg.set(l.name, l.kg)
    }
  }
  return rows.toReversed()
})()

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)

const inMonthToDate = (monthStart: Date) => (s: Session) =>
  s.date.getUTCFullYear() === monthStart.getUTCFullYear() &&
  s.date.getUTCMonth() === monthStart.getUTCMonth() &&
  s.date.getUTCDate() <= DAYS_ELAPSED

const MTD = SESSIONS.filter(inMonthToDate(TODAY))
const PRIOR_MTD = SESSIONS.filter(inMonthToDate(priorMonthStart))

/** Strength volume by lift this month, heaviest first: the sums of the session log's rows. */
export const TOP_LIFTS: readonly { name: string; volumeKg: number; share: number }[] = (() => {
  const totals = new Map<string, number>()
  for (const r of SESSION_LOG) totals.set(r.exercise, (totals.get(r.exercise) ?? 0) + r.volumeKg)
  const total = sum([...totals.values()])
  return [...totals]
    .map(([name, volumeKg]) => ({ name, volumeKg, share: volumeKg / total }))
    .toSorted((a, b) => b.volumeKg - a.volumeKg)
})()

const changePct = (now: number, before: number): number => (now / before - 1) * 100

export const SESSIONS_MTD = MTD.length
export const SESSIONS_PRIOR = PRIOR_MTD.length
export const SESSIONS_CHANGE_PCT = changePct(SESSIONS_MTD, SESSIONS_PRIOR)
export const VOLUME_MTD_KG = sum(TOP_LIFTS.map((l) => l.volumeKg))
const VOLUME_PRIOR_KG = sum(PRIOR_MTD.map((s) => s.volumeKg))
export const VOLUME_CHANGE_PCT = changePct(VOLUME_MTD_KG, VOLUME_PRIOR_KG)
export const DISTANCE_MTD_KM = sum(MTD.map((s) => s.km))
const DISTANCE_PRIOR_KM = sum(PRIOR_MTD.map((s) => s.km))
export const DISTANCE_CHANGE_PCT = changePct(DISTANCE_MTD_KM, DISTANCE_PRIOR_KM)

/** Sessions the plan expects by today if they were spread evenly over the month. */
export const PACE_SESSIONS = (GOAL_SESSIONS * DAYS_ELAPSED) / MONTH_DAYS
/** Sessions ahead of (+) or behind (−) that pace, in whole sessions. */
export const PACE_GAP = Math.round(SESSIONS_MTD - PACE_SESSIONS)

const TREND_DAYS = 30
const dayStart = (daysAgo: number): number => Date.UTC(YEAR, month, DAYS_ELAPSED) - daysAgo * DAY_MS

/** The rolling 7-day total of `pick`, one point per day over the last 30 days, oldest first. */
const rolling7 = (pick: (s: Session) => number): readonly number[] =>
  Array.from({ length: TREND_DAYS }, (_, k) => {
    const end = dayStart(TREND_DAYS - 1 - k)
    return sum(
      SESSIONS.filter((s) => {
        const t = s.date.getTime()
        return t <= end && t > end - 7 * DAY_MS
      }).map(pick),
    )
  })

export const SESSIONS_7D_TREND = rolling7(() => 1)
export const VOLUME_7D_TREND = rolling7((s) => s.volumeKg)
export const DISTANCE_7D_TREND = rolling7((s) => s.km)
const trendPoints = (values: readonly number[]) => timedPoints(values, dayStart(0), DAY_MS)
export const SESSIONS_7D_POINTS = trendPoints(SESSIONS_7D_TREND)
export const VOLUME_7D_POINTS = trendPoints(VOLUME_7D_TREND)
export const DISTANCE_7D_POINTS = trendPoints(DISTANCE_7D_TREND)

const loadSince = (days: number): number =>
  sum(SESSIONS.filter((s) => s.date.getTime() > dayStart(0) - days * DAY_MS).map((s) => s.load))

/** Load of the last 7 days, in arbitrary units. */
export const ACUTE_LOAD = loadSince(7)
/** The weekly average over the last 28 days — what the body is used to. */
export const CHRONIC_LOAD = loadSince(28) / 4
/** Acute:chronic workload ratio — this week against the 4-week norm. */
export const LOAD_RATIO = ACUTE_LOAD / CHRONIC_LOAD
export const LOAD_MAX = 2
export const LOAD_ZONES = [
  { from: 0, to: 0.8, label: 'Low', short: 'Lo' },
  { from: 0.8, to: 1.3, label: 'Optimal', short: 'Opt' },
  { from: 1.3, to: 1.5, label: 'High', short: 'Hi' },
  { from: 1.5, to: LOAD_MAX, label: 'Overreaching', short: 'Over' },
] as const
export const loadZoneName = (ratio: number): string => zoneFor(LOAD_ZONES, ratio)?.label ?? '—'

export const READINESS_ZONES = [
  { from: 0, to: 60, label: 'Low', short: 'Lo' },
  { from: 60, to: 80, label: 'Fair' },
  { from: 80, to: 100, label: 'Good' },
] as const
export const readinessLevel = (score: number): string =>
  zoneFor(READINESS_ZONES, score)?.label ?? '—'

/** The load contributor: 100 at a ratio of 1, falling 100 points per 1.0 of distance from it. */
const loadScore = (ratio: number): number =>
  Math.max(0, Math.round(100 - Math.abs(ratio - 1) * 100))

type Contributor = { key: string; label: string; value: number }
export const CONTRIBUTORS: readonly Contributor[] = [
  { key: 'sleep', label: 'Sleep', value: Math.round(between(70, 92)) },
  { key: 'hrv', label: 'HRV balance', value: Math.round(between(55, 85)) },
  { key: 'recovery', label: 'Recovery time', value: Math.round(between(60, 90)) },
  { key: 'load', label: 'Load balance', value: loadScore(LOAD_RATIO) },
]
/** The readiness reading: the mean of its contributors, 0–100. */
export const READINESS_SCORE = Math.round(
  sum(CONTRIBUTORS.map((c) => c.value)) / CONTRIBUTORS.length,
)

/** Strength sessions this month, counted from the log's distinct days: one session holds several lifts. */
const STRENGTH_DAYS = new Set(SESSION_LOG.map((r) => r.date.getTime())).size

export const TYPE_MIX = SESSION_TYPES.map((type) => ({
  type,
  label: TYPE_LABEL[type],
  count: type === 'strength' ? STRENGTH_DAYS : MTD.filter((s) => s.type === type).length,
}))

/** Sessions in each of the six complete months before this one, oldest first. */
export const MONTHLY_SESSIONS: readonly number[] = Array.from({ length: HIT_MONTHS }, (_, k) => {
  const start = Date.UTC(YEAR, month - HIT_MONTHS + k, 1)
  const end = Date.UTC(YEAR, month - HIT_MONTHS + k + 1, 1)
  return SESSIONS.filter((s) => s.date.getTime() >= start && s.date.getTime() < end).length
})
export const MONTHS_HIT = MONTHLY_SESSIONS.filter((n) => n >= GOAL_SESSIONS).length
export const HIT_RATE_PCT = Math.round((MONTHS_HIT / HIT_MONTHS) * 100)

/** Each complete month with its short name and whether it reached the goal, oldest first. */
export const HIT_HISTORY: readonly { label: string; sessions: number }[] = MONTHLY_SESSIONS.map(
  (sessions, k) => ({
    label: monthName(new Date(Date.UTC(YEAR, month - HIT_MONTHS + k, 1)), 'short'),
    sessions,
  }),
)
