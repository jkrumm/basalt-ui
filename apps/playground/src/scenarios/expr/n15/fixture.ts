import { createFormat } from 'basalt-ui'

/** One walk on the pad. `pace` is seconds per km; `energy` is a 1 to 5 self-rating after the walk. */
export type Session = {
  date: string
  minutes: number
  km: number
  pace: number
  energy: number
}

/** One Monday-to-Sunday week, aggregated. `pace` is null where no distance was walked. */
export type Week = {
  key: string
  start: string
  minutes: number
  km: number
  sessions: number
  pace: number | null
  energy: number | null
  /** True for the week the reader is in: it is not over yet. */
  partial: boolean
}

export type Walks = {
  weeks: readonly Week[]
  targetMinutes: number
  sessions: number
}

/** Minutes a week should reach. */
export const TARGET_MINUTES = 150

/** The fixture's "today", a Thursday: the last week is only four days old. */
const TODAY = '2026-11-12'
const FIRST_MONDAY = '2026-09-21'
const WEEKS = 8
const DAY_MS = 86_400_000

const fmt = createFormat()

const toMs = (date: string): number => Date.parse(`${date}T00:00:00Z`)
const addDays = (date: string, n: number): string =>
  new Date(toMs(date) + n * DAY_MS).toISOString().slice(0, 10)

/** A small seeded generator, so every build draws the same walks. */
function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The fixture variants `?fixture=` names. */
export const FIXTURES = ['monday', 'marathon'] as const
export type FixtureName = (typeof FIXTURES)[number]

export const isFixtureName = (value: string | undefined): value is FixtureName =>
  FIXTURES.some((name) => name === value)

/** About 60 walks over 8 weeks; week 4 is a rest week and some days carry two walks. */
function drawSessions(): Session[] {
  const rand = mulberry32(1504)
  const sessions: Session[] = []
  for (let w = 0; w < WEEKS; w += 1) {
    if (w === 3) continue
    for (let d = 0; d < 7; d += 1) {
      const date = addDays(FIRST_MONDAY, w * 7 + d)
      if (date > TODAY) continue
      const walkDay = rand() < (d < 5 ? 0.92 : 0.65)
      if (!walkDay) continue
      const count = rand() < 0.5 ? 2 : 1
      for (let s = 0; s < count; s += 1) {
        const minutes = Math.round(10 + rand() * 12)
        const pace = Math.round(700 - w * 6.5 + (rand() - 0.5) * 50)
        sessions.push({
          date,
          minutes,
          km: Math.round(((minutes * 60) / pace) * 100) / 100,
          pace,
          energy: Math.min(5, Math.max(1, Math.round(2 + w * 0.2 + rand() * 2.4))),
        })
      }
    }
  }
  return sessions
}

/** An extreme: one three-hour hike on the pad in the last full week. */
function withMarathon(sessions: readonly Session[]): Session[] {
  const pace = 640
  return [
    ...sessions,
    {
      date: '2026-11-08',
      minutes: 190,
      km: Math.round(((190 * 60) / pace) * 100) / 100,
      pace,
      energy: 3,
    },
  ]
}

function aggregate(sessions: readonly Session[]): Week[] {
  return Array.from({ length: WEEKS }, (_, w) => {
    const start = addDays(FIRST_MONDAY, w * 7)
    const end = addDays(start, 6)
    const rows = sessions.filter((s) => s.date >= start && s.date <= end)
    const minutes = rows.reduce((sum, s) => sum + s.minutes, 0)
    const km = rows.reduce((sum, s) => sum + s.km, 0)
    const energy = rows.reduce((sum, s) => sum + s.energy, 0)
    return {
      key: fmt.date(start as `${number}-${number}-${number}`, 'short', { year: undefined }),
      start,
      minutes,
      km: Math.round(km * 10) / 10,
      sessions: rows.length,
      pace: km > 0 ? Math.round((minutes * 60) / km) : null,
      energy: rows.length > 0 ? Math.round((energy / rows.length) * 10) / 10 : null,
      partial: end > TODAY,
    }
  })
}

/** The walks the scenario shows; `monday` is the week's first morning, `marathon` the extreme. */
export function walks(name: FixtureName | undefined): Walks {
  const base = drawSessions()
  const sessions =
    name === 'monday'
      ? base.filter((s) => s.date < '2026-11-09')
      : name === 'marathon'
        ? withMarathon(base)
        : base
  return { weeks: aggregate(sessions), targetMinutes: TARGET_MINUTES, sessions: sessions.length }
}

/** `m:ss` from seconds, rounding to the second before splitting so 59.6 never prints `:60`. */
export function mmss(seconds: number): string {
  const total = Math.round(Math.abs(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** Pace over several weeks: total time over total distance, not the mean of the weekly paces. */
export function paceOf(weeks: readonly Week[]): number | null {
  const minutes = weeks.reduce((sum, w) => sum + (w.pace === null ? 0 : w.minutes), 0)
  const km = weeks.reduce((sum, w) => sum + w.km, 0)
  return km > 0 ? Math.round((minutes * 60) / km) : null
}
