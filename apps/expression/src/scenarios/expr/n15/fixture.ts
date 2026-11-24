/**
 * Desk walks: about 60 sessions over 8 weeks (Monday to Sunday), a weekly time target and some days
 * with two walks. Seeded, so every build draws the same pad. "Today" is a fixed Thursday: the last
 * week is unfinished, which is what the page has to say out loud.
 */

export type Slot = 'am' | 'pm'

export type Walk = {
  id: string
  /** Epoch ms (UTC) of the start. */
  at: number
  /** 0 to 7: the week the walk belongs to, 7 being the unfinished one. */
  week: number
  /** The walk belongs to the unfinished week. */
  current: boolean
  slot: Slot
  minutes: number
  km: number
  /** Seconds per km; lower is faster. */
  paceSec: number
  kcal: number
  /** The median pace of the walk's week. */
  weekPace: number
  /** One walk per week carries the week's pace line point. */
  anchor: boolean
}

export type Week = {
  key: string
  start: number
  minutes: number
  km: number
  walks: number
  /** Days with two walks. */
  doubles: number
  /** The week is not over: Monday to today only. */
  partial: boolean
  current: boolean
}

export type Pad = {
  walks: readonly Walk[]
  weeks: readonly Week[]
  /** Minutes a week is meant to hold. */
  target: number
  /** Days of the unfinished week that have passed, today included. */
  elapsedDays: number
  /** The target scaled to the days that have passed. */
  due: number
  /** The first day of the pad. */
  from: number
  /** The end of today. */
  until: number
}

const TARGET_MIN = 150

const DAY = 86_400_000
const FIRST_MONDAY = Date.UTC(2026, 8, 28)
const WEEKS = 8
const TODAY_INDEX = 52
const ELAPSED_DAYS = (TODAY_INDEX % 7) + 1
const ISO_WEEK_OF_FIRST = 40

const FIXTURES = ['extreme', 'fresh'] as const
export type FixtureName = (typeof FIXTURES)[number]

export const isFixtureName = (name: string | undefined): name is FixtureName =>
  FIXTURES.some((f) => f === name)

function seeded(seed: number): () => number {
  let s = seed
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const AWAY_WEEK = 3
const LONG_WALK_DAY = 5 * 7 + 5

type Draft = Omit<Walk, 'weekPace' | 'anchor'>

function draftWalks(fixture: FixtureName | undefined): Draft[] {
  const rand = seeded(1511)
  const drafts: Draft[] = []
  for (let day = 0; day <= TODAY_INDEX; day += 1) {
    const week = Math.floor(day / 7)
    const weekday = day % 7
    const progress = day / TODAY_INDEX
    const current = week === WEEKS - 1
    const skip = week === AWAY_WEEK || (fixture === 'fresh' && current)
    const walkOdds = weekday < 5 ? 0.97 : weekday === 5 ? 0.6 : 0.45
    const walking = !skip && rand() < walkOdds
    const slots: Slot[] = !walking
      ? []
      : weekday < 5 && rand() < 0.7
        ? ['am', 'pm']
        : [rand() < 0.5 ? 'am' : 'pm']
    for (const slot of slots) {
      const minutes = Math.round(11 + rand() * 16)
      const paceSec = Math.round(428 - 52 * progress + (rand() - 0.5) * 26)
      const km = Math.round(((minutes * 60) / paceSec) * 10) / 10
      drafts.push({
        id: `w-${day}-${slot}`,
        at: FIRST_MONDAY + day * DAY + (slot === 'am' ? 7.5 : 17.5) * 3_600_000,
        week,
        current,
        slot,
        minutes,
        km,
        paceSec,
        kcal: Math.round(km * 56 + minutes * 0.4 + rand() * 6),
      })
    }
  }
  if (fixture === 'extreme') {
    drafts.push({
      id: 'w-long',
      at: FIRST_MONDAY + LONG_WALK_DAY * DAY + 9 * 3_600_000,
      week: 5,
      current: false,
      slot: 'am',
      minutes: 270,
      km: 20.5,
      paceSec: Math.round((270 * 60) / 20.5),
      kcal: 1380,
    })
  }
  return drafts.sort((a, b) => a.at - b.at)
}

/** The median pace of some walks: one slow stroll does not drag it, which a total over total would. */
const medianPace = (rows: readonly { paceSec: number }[]): number => {
  const sorted = rows.map((r) => r.paceSec).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length === 0) return 0
  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
}

/** The pad for a fixture name; `undefined` is the ordinary pad, with an away week that holds no walk. */
export function buildPad(fixture: FixtureName | undefined): Pad {
  const drafts = draftWalks(fixture)
  const weeks: Week[] = Array.from({ length: WEEKS }, (_, i) => {
    const rows = drafts.filter((d) => d.week === i)
    const days = new Set(rows.map((r) => Math.floor((r.at - FIRST_MONDAY) / DAY)))
    return {
      key: `W${ISO_WEEK_OF_FIRST + i}`,
      start: FIRST_MONDAY + i * 7 * DAY,
      minutes: rows.reduce((sum, r) => sum + r.minutes, 0),
      km: Math.round(rows.reduce((sum, r) => sum + r.km, 0) * 10) / 10,
      walks: rows.length,
      doubles: days.size === 0 ? 0 : rows.length - days.size,
      partial: i === WEEKS - 1,
      current: i === WEEKS - 1,
    }
  })
  const weekPace = weeks.map((_, i) => medianPace(drafts.filter((d) => d.week === i)))
  const walks = drafts.map((d, index) => {
    const mates = drafts.filter((m) => m.week === d.week)
    const anchor = mates[Math.floor(mates.length / 2)]?.id === d.id
    return { ...d, weekPace: weekPace[d.week] ?? 0, anchor, index }
  })
  return {
    walks: walks.map(({ index: _index, ...w }) => w),
    weeks,
    target: TARGET_MIN,
    elapsedDays: ELAPSED_DAYS,
    due: Math.round((TARGET_MIN * ELAPSED_DAYS) / 7),
    from: FIRST_MONDAY,
    until: FIRST_MONDAY + (TODAY_INDEX + 1) * DAY,
  }
}

export { medianPace }
