/**
 * The athlete's year: Dec 1, 2024 to Nov 30, 2025, drawn from a seeded generator so every build
 * shows the same 300-odd activities. The default fixture holds a two-week break in January and a
 * few days with two sessions; `no-winter` leaves Dec to Feb empty (a zero), `ultra` adds one
 * 11-hour ride (an extreme).
 */

export const SPORTS = ['Run', 'Ride', 'Swim', 'Strength'] as const
export type Sport = (typeof SPORTS)[number]

export type Activity = {
  id: string
  /** Days since the window start. */
  day: number
  sport: Sport
  minutes: number
  /** Distance in km where the sport has one. */
  km: number | null
}

export const DAY_MS = 86_400_000
export const START = Date.UTC(2024, 11, 1)
export const DAYS = 365
/** Window month 0 is December 2024. */
export const MONTHS = 12
const WINTER_MONTHS = 3
export const WINTER_DAYS = 31 + 31 + 28

const FIXTURES = ['no-winter', 'ultra'] as const
export type Fixture = (typeof FIXTURES)[number]
export const isFixture = (v: string | undefined): v is Fixture => FIXTURES.some((f) => f === v)

/** A two-week break: Jan 8 to Jan 21 (days 38 to 51). */
const BREAK = { from: 38, to: 51 } as const

export const dateOf = (day: number): Date => new Date(START + day * DAY_MS)
/** Window month (0 = Dec 2024) of a day. */
export const monthOf = (day: number): number => {
  const d = dateOf(day)
  return (d.getUTCMonth() + 1) % 12
}
export const isWinterDay = (day: number): boolean => monthOf(day) < WINTER_MONTHS

function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(rand: () => number, weights: readonly (readonly [T, number])[]): T => {
  const total = weights.reduce((sum, [, w]) => sum + w, 0)
  let at = rand() * total
  for (const [item, w] of weights) {
    at -= w
    if (at < 0) return item
  }
  return weights[0]![0]
}

const between = (rand: () => number, lo: number, hi: number): number =>
  Math.round(lo + rand() * (hi - lo))

function session(rand: () => number, day: number, n: number): Activity {
  const winter = isWinterDay(day)
  const summer = monthOf(day) >= 6 && monthOf(day) <= 8
  const sport = pick<Sport>(rand, [
    ['Run', 40],
    ['Ride', winter ? 10 : summer ? 35 : 25],
    ['Swim', winter ? 25 : 12],
    ['Strength', winter ? 30 : 18],
  ])
  const minutes =
    sport === 'Run'
      ? between(rand, 28, 80)
      : sport === 'Ride'
        ? between(rand, 55, summer ? 210 : 140)
        : between(rand, 30, 60)
  const pace =
    sport === 'Run'
      ? 0.15 + rand() * 0.04
      : sport === 'Ride'
        ? 0.38 + rand() * 0.1
        : 0.03 + rand() * 0.01
  const km = sport === 'Strength' ? null : Math.round(minutes * pace * 10) / 10
  return { id: `a${day}-${n}`, day, sport, minutes, km }
}

export function buildYear(fixture: Fixture | undefined): Activity[] {
  const rand = seeded(48)
  const out: Activity[] = []
  for (let day = 0; day < DAYS; day++) {
    const month = monthOf(day)
    const chance = month < WINTER_MONTHS ? 0.52 : month >= 6 && month <= 8 ? 0.84 : 0.74
    const trains = rand() < chance || day === BREAK.from - 1 || day === BREAK.to + 1
    const twice = rand() < 0.2
    const inBreak = day >= BREAK.from && day <= BREAK.to
    if (!trains || inBreak) continue
    if (fixture === 'no-winter' && month < WINTER_MONTHS) continue
    out.push(session(rand, day, 0))
    if (twice) out.push(session(rand, day, 1))
  }
  if (fixture === 'ultra') {
    const day = 195
    out.push({ id: `a${day}-ultra`, day, sport: 'Ride', minutes: 660, km: 265.4 })
  }
  return out.sort((a, b) => a.day - b.day || SPORTS.indexOf(a.sport) - SPORTS.indexOf(b.sport))
}

/** The longest run of days with no activity, from the data. */
export function longestBreak(acts: readonly Activity[]): { from: number; to: number } | null {
  const trained = new Set(acts.map((a) => a.day))
  let best: { from: number; to: number } | null = null
  let from = -1
  for (let day = 0; day <= DAYS; day++) {
    const off = day < DAYS && !trained.has(day)
    if (off && from < 0) from = day
    if (!off && from >= 0) {
      if (best === null || day - 1 - from > best.to - best.from) best = { from, to: day - 1 }
      from = -1
    }
  }
  return best
}

export type Season = { days: number; of: number }
export function trainedDays(acts: readonly Activity[], winter: boolean): Season {
  const days = new Set(acts.filter((a) => isWinterDay(a.day) === winter).map((a) => a.day))
  return { days: days.size, of: winter ? WINTER_DAYS : DAYS - WINTER_DAYS }
}
