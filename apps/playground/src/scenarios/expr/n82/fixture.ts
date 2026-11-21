/**
 * Planning-poker counts: five counts for the last 24 hours and for each of the 30 days before it,
 * seeded so every render draws the same page. The 30 days hold a day with all five at zero, a spike
 * day (500 votes against a typical 3) and a day whose unique users exceed its page views.
 */

export type Counts = {
  votes: number
  estimations: number
  rooms: number
  users: number
  views: number
}
export type MeasureKey = keyof Counts

/** One bar of the page: a calendar day, or the last 24 hours (`date` is null). */
export type Day = Counts & { key: string; date: Date | null }
export type Finding = 'spike' | 'zero' | 'inverted'

export const NOW_KEY = 'now'
export const KEYS: readonly MeasureKey[] = ['votes', 'estimations', 'rooms', 'users', 'views']

const PRIOR_DAYS = 30
const FIRST_DAY = Date.UTC(2026, 9, 22)
const SPIKE_FACTOR = 10

/** Mulberry32: a small seeded generator, so the fixture never varies between renders. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const dayAt = (offset: number): Date => new Date(FIRST_DAY + offset * 86_400_000)

function ordinaryDay(next: () => number): Counts {
  const votes = 2 + Math.floor(next() * 4)
  const estimations = Math.min(votes, 1 + Math.floor(next() * 3))
  const rooms = next() > 0.7 ? 2 : 1
  const users = 2 + Math.floor(next() * 3)
  const views = Math.max(users * 2, 8 + Math.floor(next() * 13))
  return { votes, estimations, rooms, users, views }
}

const ZERO: Counts = { votes: 0, estimations: 0, rooms: 0, users: 0, views: 0 }

/** The last 24 hours of each fixture: a normal morning, a silent one, a spike. */
function lastWindow(fixture: string | undefined): Counts {
  if (fixture === 'quiet') return ZERO
  if (fixture === 'spike') return { votes: 500, estimations: 61, rooms: 4, users: 9, views: 133 }
  return { votes: 4, estimations: 2, rooms: 1, users: 3, views: 14 }
}

export function buildDays(fixture: string | undefined): Day[] {
  const next = seeded(82)
  const days: Day[] = Array.from({ length: PRIOR_DAYS }, (_, i) => {
    const date = dayAt(i)
    return { key: date.toISOString().slice(0, 10), date, ...ordinaryDay(next) }
  })
  const zeroDay = days[13]
  const spikeDay = days[20]
  const invertedDay = days[7]
  if (zeroDay) Object.assign(zeroDay, ZERO)
  if (spikeDay)
    Object.assign(spikeDay, { votes: 500, estimations: 64, rooms: 5, users: 11, views: 148 })
  if (invertedDay) Object.assign(invertedDay, { users: 14, views: 9 })
  return [...days, { key: NOW_KEY, date: null, ...lastWindow(fixture) }]
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const upper = sorted[mid] ?? 0
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] ?? 0) + upper) / 2
}

/** The typical day: the median of each count over the 30 days before the last 24 hours. */
export function typicalDay(days: readonly Day[]): Counts {
  const prior = days.filter((d) => d.key !== NOW_KEY)
  const at = (key: MeasureKey) => median(prior.map((d) => d[key]))
  return {
    votes: at('votes'),
    estimations: at('estimations'),
    rooms: at('rooms'),
    users: at('users'),
    views: at('views'),
  }
}

export function findingOf(day: Day, typical: Counts): Finding | null {
  if (KEYS.every((key) => day[key] === 0)) return 'zero'
  if (day.votes > SPIKE_FACTOR * typical.votes) return 'spike'
  if (day.users > day.views) return 'inverted'
  return null
}

/** The highest count of a measure that is not itself an outlier, or null when none is: the cap the kit clamps to. */
export function capOf(days: readonly Day[], key: MeasureKey, typical: Counts): number | null {
  const limit = 5 * Math.max(typical[key], 1)
  const values = days.map((d) => d[key])
  if (values.every((v) => v <= limit)) return null
  return Math.max(...values.filter((v) => v <= limit))
}
