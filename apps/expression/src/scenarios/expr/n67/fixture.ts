/** Seeded training block for scenario expr-n67: 90 days, four lifts, weekly volume, a daily recovery score. */

export type LiftKey = 'squat' | 'bench' | 'deadlift' | 'press'
export type BlockVariant = 'default' | 'extreme' | 'matched'

export const LIFTS: readonly { key: LiftKey; name: string }[] = [
  { key: 'squat', name: 'Squat' },
  { key: 'bench', name: 'Bench' },
  { key: 'deadlift', name: 'Deadlift' },
  { key: 'press', name: 'Press' },
]

const DAY_COUNT = 90
/** The last 35 days: the window "still rising" asks about. */
export const WINDOW_DAYS = 35
/** A lift is rising when its last two weeks sit this many kg above the window's first two weeks. */
const RISE_KG = 1
/** A week runs ahead of recovery when its mean session intensity beats its mean recovery by more than this. */
export const AHEAD_POINTS = 15

/** A flat lift still reads a little different each session, kg. */
const FLAT_WOBBLE: readonly number[] = [0, 0, 0.5, 0, 0, -0.5]
const DAY_MS = 86_400_000
/** Monday 17 Aug 2026: 90 days end on Saturday 14 Nov, so the last week has six days. */
const START = Date.UTC(2026, 7, 17)
/** Weekday index of a session: Monday, Wednesday, Friday, Saturday. */
const SESSION_DAYS: Readonly<Record<number, readonly LiftKey[]>> = {
  0: ['squat', 'bench'],
  2: ['deadlift', 'press'],
  4: ['squat', 'bench'],
  5: ['deadlift', 'press'],
}

type Plan = {
  /** Session volume in kg per week; 0 is a week with no training. */
  volume: readonly number[]
  intensity: readonly number[]
  recovery: readonly number[]
}

const PLAN: Plan = {
  volume: [7200, 7300, 7400, 7500, 7500, 0, 6200, 7600, 7900, 9100, 9500, 7400, 7500],
  intensity: [60, 62, 63, 64, 65, 0, 55, 66, 70, 84, 86, 66, 64],
  recovery: [72, 74, 71, 70, 69, 88, 80, 70, 62, 52, 50, 63, 68],
}
const MATCHED: Plan = {
  volume: PLAN.volume,
  intensity: PLAN.intensity.map((v, w) => (w === 9 || w === 10 ? 66 + (w - 9) * 2 : v)),
  recovery: PLAN.recovery.map((v, w) => (w === 9 || w === 10 ? 62 - (w - 9) * 2 : v)),
}

/** Gain per day by the end of the block, and where each lift's trend stops. */
const TREND: Record<LiftKey, { base: number; perDay: number; stopsAt: number }> = {
  squat: { base: 140, perDay: 0.18, stopsAt: DAY_COUNT },
  bench: { base: 100, perDay: 0.1, stopsAt: DAY_COUNT },
  deadlift: { base: 170, perDay: 0.157, stopsAt: DAY_COUNT },
  press: { base: 56, perDay: 4 / 54, stopsAt: 54 },
}

function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
const mean = (xs: readonly number[]): number => xs.reduce((s, v) => s + v, 0) / xs.length

export type Day = {
  index: number
  day: Date
  week: number
  /** Estimated one-rep max in kg per lift; null where the lift was not trained. */
  e1rm: Record<LiftKey, number | null>
  /** kg above the lift's first session. */
  gain: Record<LiftKey, number | null>
  /** Session intensity score, 0 to 100; null on a day without a session. */
  intensity: number | null
  /** Recovery score, 0 to 100. */
  recovery: number
  /** Volume of the day's week in kg. */
  weekVolume: number
}

export type Verdict = 'ahead' | 'matched' | 'rest'

export type Week = {
  id: string
  index: number
  from: Date
  to: Date
  days: number
  sessions: number
  volume: number
  intensity: number | null
  recovery: number
  gap: number | null
  verdict: Verdict
}

export type LiftSummary = {
  key: LiftKey
  name: string
  sessions: number
  /** Mean e1RM of the last two weeks, kg. */
  now: number
  /** Change from the window's first two weeks to its last two weeks, kg. */
  change: number
  rising: boolean
}

export type Block = {
  days: readonly Day[]
  weeks: readonly Week[]
  lifts: readonly LiftSummary[]
  windowStart: Date
  lastDay: Date
  maxVolume: number
}

/** Runs of consecutive weeks with one verdict, as the day span each covers (to is the start of the day after). */
export function verdictRuns(weeks: readonly Week[], verdict: Verdict): { from: Date; to: Date }[] {
  const runs: { from: Date; to: Date }[] = []
  let open: { from: Date; to: Date } | null = null
  for (const w of weeks) {
    if (w.verdict !== verdict) {
      open = null
      continue
    }
    const to = new Date(w.to.getTime() + DAY_MS)
    if (open === null) {
      open = { from: w.from, to }
      runs.push(open)
    } else open.to = to
  }
  return runs
}

export function buildBlock(variant: BlockVariant): Block {
  const random = rng(67)
  const plan = variant === 'matched' ? MATCHED : PLAN
  const noise = (amp: number): number => (random() * 2 - 1) * amp
  const days: Day[] = []
  let flatSessions = 0
  const sessionVolume: number[] = []
  for (let i = 0; i < DAY_COUNT; i += 1) {
    const week = Math.floor(i / 7)
    const lifts = SESSION_DAYS[i % 7]
    const trains = lifts !== undefined && plan.volume[week] !== 0
    const e1rm: Record<LiftKey, number | null> = {
      squat: null,
      bench: null,
      deadlift: null,
      press: null,
    }
    if (trains) {
      for (const key of lifts) {
        const t = TREND[key]
        const rise = variant === 'matched' && key === 'press' ? 9 / DAY_COUNT : t.perDay
        const stop = variant === 'matched' && key === 'press' ? DAY_COUNT : t.stopsAt
        const flat = key === 'press' && variant !== 'matched' && i > t.stopsAt
        if (flat) flatSessions += 1
        const wobble = flat ? (FLAT_WOBBLE[flatSessions % FLAT_WOBBLE.length] ?? 0) : noise(0.8)
        e1rm[key] = Math.round((t.base + rise * Math.min(i, stop) + wobble) * 2) / 2
      }
    }
    if (variant === 'extreme' && i === 70) e1rm.squat = 190
    const dayEffect = [0, -4, 0, -3, 0, 0, 6][i % 7] ?? 0
    const lowDay = i === 67 ? -30 : 0
    const volumeFactor = variant === 'extreme' && week === 10 ? 14500 / 9500 : 1
    sessionVolume.push(
      trains
        ? Math.round(((plan.volume[week] ?? 0) * volumeFactor * (1 + noise(0.06))) / 10) * 10
        : 0,
    )
    days.push({
      index: i,
      day: new Date(START + i * DAY_MS),
      week,
      e1rm,
      gain: { squat: null, bench: null, deadlift: null, press: null },
      intensity: trains ? Math.round(clamp((plan.intensity[week] ?? 0) + noise(4), 0, 100)) : null,
      recovery: Math.round(
        clamp((plan.recovery[week] ?? 0) + dayEffect + lowDay + noise(4), 0, 100),
      ),
      weekVolume: 0,
    })
  }

  const weekCount = Math.ceil(DAY_COUNT / 7)
  const volumes = Array.from({ length: weekCount }, (_, w) =>
    sessionVolume.slice(w * 7, w * 7 + 7).reduce((s, v) => s + v, 0),
  )
  const first: Partial<Record<LiftKey, number>> = {}
  for (const d of days) {
    d.weekVolume = volumes[d.week] ?? 0
    for (const { key } of LIFTS) {
      const v = d.e1rm[key]
      if (v === null) continue
      first[key] ??= v
      d.gain[key] = Math.round((v - (first[key] ?? v)) * 2) / 2
    }
  }

  const weeks: Week[] = volumes.map((volume, w) => {
    const inWeek = days.filter((d) => d.week === w)
    const scores = inWeek.flatMap((d) => (d.intensity === null ? [] : [d.intensity]))
    const intensity = scores.length === 0 ? null : Math.round(mean(scores))
    const recovery = Math.round(mean(inWeek.map((d) => d.recovery)))
    const gap = intensity === null ? null : intensity - recovery
    const verdict: Verdict = gap === null ? 'rest' : gap > AHEAD_POINTS ? 'ahead' : 'matched'
    return {
      id: `w${w}`,
      index: w,
      from: inWeek[0]?.day ?? new Date(START),
      to: inWeek.at(-1)?.day ?? new Date(START),
      days: inWeek.length,
      sessions: scores.length,
      volume,
      intensity,
      recovery,
      gap,
      verdict,
    }
  })

  const windowFirst = DAY_COUNT - WINDOW_DAYS
  const lifts: LiftSummary[] = LIFTS.map(({ key, name }) => {
    const at = (from: number, to: number): number[] =>
      days.slice(from, to).flatMap((d) => (d.e1rm[key] === null ? [] : [d.e1rm[key] ?? 0]))
    const now = mean(at(DAY_COUNT - 14, DAY_COUNT))
    const then = mean(at(windowFirst, windowFirst + 14))
    const change = Math.round((now - then) * 10) / 10
    return {
      key,
      name,
      sessions: days.filter((d) => d.e1rm[key] !== null).length,
      now: Math.round(now * 10) / 10,
      change,
      rising: change >= RISE_KG,
    }
  })

  return {
    days,
    weeks,
    lifts,
    windowStart: days[windowFirst]?.day ?? new Date(START),
    lastDay: days.at(-1)?.day ?? new Date(START),
    maxVolume: Math.max(...volumes),
  }
}
