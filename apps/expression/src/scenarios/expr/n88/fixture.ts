/** Seeded, deterministic review log of two seats over 30 days (day 0 is 2026-10-22, day 29 is 2026-11-20). */

export type SeatKey = 'light' | 'lead'

export type Review = {
  id: string
  seat: SeatKey
  day: number
  attempts: number
  /** `null`: verification has not reported yet. */
  firstPass: boolean | null
  regression: boolean
  refused: boolean
  cycleMin: number
  costUsd: number
  movedUp: boolean
}

export type Day = {
  day: number
  at: Date
  /** Running first-pass rate in percent, `null` while no Issue of the seat is verified. */
  lightRate: number | null
  leadRate: number | null
  lightCost: number | null
  leadCost: number | null
  lightMoved: number | null
}

export type SeatRow = {
  key: SeatKey
  seat: string
  issues: number
  firstPassPct: number | null
  regressions: number | null
  refusals: number | null
  cycleMin: number | null
  costUsd: number | null
  movedUp: number | null
}

export type Fixture = {
  reviews: readonly Review[]
  days: readonly Day[]
  seats: readonly [SeatRow, SeatRow]
  verifiedLight: number
  issuesLight: number
  costliest: readonly Review[]
}

export const FIXTURE_NAMES = ['zero', 'extreme'] as const
export const WINDOW_DAYS = 30
const FIRST_DAY = Date.UTC(2026, 9, 22)
const DAY_MS = 86_400_000
/** The light seat's first week: verification has not reported on its Issues yet. */
const PENDING_DAYS = 7

function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const median = (xs: readonly number[]): number | null => {
  if (xs.length === 0) return null
  const s = xs.toSorted((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 1 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2
}

type Plan = {
  seat: SeatKey
  seed: number
  firstId: number
  /** Share of Issues that pass first verification. */
  pass: number
  attemptCost: number
  cycle: number
  /** Indexes of Issues the seat refuses. */
  refused: readonly number[]
  /** Indexes of Issues that regress after passing. */
  regress: readonly number[]
  /** Index of the one Issue that burns four attempts. */
  burn: number | null
  burnCost: number
}

function seatReviews(plan: Plan): Review[] {
  const next = rng(plan.seed)
  return Array.from({ length: 60 }, (_, i): Review => {
    const day = Math.min(WINDOW_DAYS - 1, Math.floor(i / 2))
    const r = next()
    const refused = plan.refused.includes(i)
    const burned = plan.burn === i
    const attempts = burned ? 4 : refused ? 1 : r < plan.pass ? 1 : r < plan.pass + 0.1 ? 2 : 3
    const perAttempt = burned ? plan.burnCost : plan.attemptCost * (0.8 + next() * 0.4)
    const pending = plan.seat === 'light' && day < PENDING_DAYS
    return {
      id: `#${plan.firstId + i}`,
      seat: plan.seat,
      day,
      attempts,
      firstPass: pending ? null : !refused && attempts === 1,
      regression: plan.regress.includes(i),
      refused,
      cycleMin: Math.round(plan.cycle * (0.6 + next() * 0.8) * Math.sqrt(attempts)),
      costUsd: Math.round(perAttempt * attempts * 100) / 100,
      movedUp:
        plan.seat === 'light' && (refused || attempts >= 3 || (attempts === 2 && next() < 0.6)),
    }
  })
}

function seatRow(key: SeatKey, reviews: readonly Review[]): SeatRow {
  const mine = reviews.filter((r) => r.seat === key)
  const seat = key === 'light' ? 'Light seat' : 'Lead seat'
  if (mine.length === 0) {
    return {
      key,
      seat,
      issues: 0,
      firstPassPct: null,
      regressions: null,
      refusals: null,
      cycleMin: null,
      costUsd: null,
      movedUp: null,
    }
  }
  const verified = mine.filter((r) => r.firstPass !== null)
  return {
    key,
    seat,
    issues: mine.length,
    firstPassPct:
      verified.length === 0
        ? null
        : Math.round((verified.filter((r) => r.firstPass === true).length / verified.length) * 100),
    regressions: mine.filter((r) => r.regression).length,
    refusals: mine.filter((r) => r.refused).length,
    cycleMin: median(mine.map((r) => r.cycleMin)),
    costUsd: mine.reduce((sum, r) => sum + r.costUsd, 0) / mine.length,
    movedUp: key === 'light' ? mine.filter((r) => r.movedUp).length : null,
  }
}

function runningDays(reviews: readonly Review[]): Day[] {
  return Array.from({ length: WINDOW_DAYS }, (_, day): Day => {
    const upTo = (key: SeatKey) => reviews.filter((r) => r.seat === key && r.day <= day)
    const rate = (rows: readonly Review[]): number | null => {
      const verified = rows.filter((r) => r.firstPass !== null)
      if (verified.length === 0) return null
      return (verified.filter((r) => r.firstPass === true).length / verified.length) * 100
    }
    const cost = (rows: readonly Review[]): number | null =>
      rows.length === 0 ? null : rows.reduce((sum, r) => sum + r.costUsd, 0) / rows.length
    const light = upTo('light')
    const lead = upTo('lead')
    return {
      day,
      at: new Date(FIRST_DAY + day * DAY_MS),
      lightRate: rate(light),
      leadRate: rate(lead),
      lightCost: cost(light),
      leadCost: cost(lead),
      lightMoved:
        light.length === 0 ? null : (light.filter((r) => r.movedUp).length / light.length) * 100,
    }
  })
}

/** `empty` is a window with no reviews at all; `zero` a light seat not started; `extreme` a four-attempt Issue forty times a typical cost. */
export function buildFixture(name: string | undefined, empty: boolean): Fixture {
  const lead = seatReviews({
    seat: 'lead',
    seed: 88_001,
    firstId: 2640,
    pass: 0.95,
    attemptCost: 1.45,
    cycle: 34,
    refused: [],
    regress: [12, 37],
    burn: 41,
    burnCost: name === 'extreme' ? 58 : 2.9,
  })
  const light = seatReviews({
    seat: 'light',
    seed: 88_002,
    firstId: 2641,
    pass: 0.8,
    attemptCost: 0.36,
    cycle: 22,
    refused: [17, 30, 44],
    regress: [20, 33, 46, 55],
    burn: null,
    burnCost: 0,
  })
  const reviews = empty ? [] : name === 'zero' ? lead : [...lead, ...light]
  const lightMine = reviews.filter((r) => r.seat === 'light')
  return {
    reviews,
    days: runningDays(reviews),
    seats: [seatRow('light', reviews), seatRow('lead', reviews)],
    verifiedLight: lightMine.filter((r) => r.firstPass !== null).length,
    issuesLight: lightMine.length,
    costliest: reviews.toSorted((a, b) => b.costUsd - a.costUsd).slice(0, 3),
  }
}
