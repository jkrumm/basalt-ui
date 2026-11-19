/** The home line over seven days (12 to 18 Nov 2026, UTC): outages, probe cycles and one hole with no measurements. Seeded, so every build draws the same week. */

export type Scope = 'gateway' | 'internet'

/** Minutes are counted from 12 Nov 00:00 UTC; an `end` of null is an outage still running at the window's end. */
export type Outage = { id: string; scope: Scope; start: number; end: number | null }
export type Hole = { start: number; end: number }
export type DayCount = { index: number; recorded: number; lossy: number; down: number }
export type LineWeek = { outages: Outage[]; hole: Hole | null; days: DayCount[] }

export const DAYS = 7
export const DAY_MIN = 1440
export const WEEK_MIN = DAYS * DAY_MIN
/** One probe cycle every 30 seconds. */
export const CYCLES_PER_DAY = 2880
export const CYCLES_EXPECTED = DAYS * CYCLES_PER_DAY
const CYCLES_PER_MIN = 2

const at = (day: number, hour: number, minute: number): number => day * DAY_MIN + hour * 60 + minute

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const outage = (id: string, scope: Scope, start: number, end: number | null): Outage => ({
  id,
  scope,
  start,
  end,
})

const WEEK: readonly Outage[] = [
  outage('o1', 'internet', at(0, 3, 10), at(0, 3, 31)),
  outage('o2', 'gateway', at(1, 19, 5), at(1, 19, 20)),
  outage('o3', 'internet', at(2, 11, 30), at(2, 12, 44)),
  outage('o4', 'gateway', at(3, 22, 15), at(3, 22, 18)),
  outage('o5', 'internet', at(4, 7, 48), at(4, 8, 0)),
  outage('o6', 'internet', at(4, 20, 30), at(4, 21, 28)),
  outage('o7', 'gateway', at(6, 22, 5), null),
]

/** The extreme week: one outage over a day long across two midnights, a burst of one-minute drops and the open one. */
const EXTREME: readonly Outage[] = [
  outage('o1', 'internet', at(0, 3, 10), at(0, 3, 31)),
  outage('o2', 'gateway', at(2, 18, 0), at(3, 20, 0)),
  ...Array.from({ length: 9 }, (_, i) =>
    outage(`f${i + 1}`, 'internet', at(5, 9 + i, 12), at(5, 9 + i, 13 + (i % 2))),
  ),
  outage('o3', 'gateway', at(6, 22, 5), null),
]

const HOLE: Hole = { start: at(3, 1, 30), end: at(3, 7, 30) }

/** Minutes of `day` an outage covers; an open outage runs to the window's end. */
function minutesOnDay(o: Outage, day: number): number {
  const from = Math.max(o.start, day * DAY_MIN)
  const to = Math.min(o.end ?? WEEK_MIN, (day + 1) * DAY_MIN)
  return Math.max(0, to - from)
}

/** The week by fixture name: `quiet` has no outage and no hole, `extreme` a 26 h outage and a burst of drops. */
export function lineWeek(name: string | undefined): LineWeek {
  const rand = mulberry32(60)
  const outages = name === 'quiet' ? [] : [...(name === 'extreme' ? EXTREME : WEEK)]
  const hole = name === 'quiet' ? null : HOLE
  const days = Array.from({ length: DAYS }, (_, index): DayCount => {
    const down = outages.reduce((sum, o) => sum + minutesOnDay(o, index), 0)
    const holeCycles = hole
      ? Math.max(
          0,
          Math.min(hole.end, (index + 1) * DAY_MIN) - Math.max(hole.start, index * DAY_MIN),
        ) * CYCLES_PER_MIN
      : 0
    const missed = name === 'quiet' ? 0 : Math.floor(rand() * 9)
    const blips = name === 'quiet' ? 0 : Math.floor(rand() * 11)
    return {
      index,
      down,
      recorded: CYCLES_PER_DAY - holeCycles - missed,
      lossy: down * CYCLES_PER_MIN + blips,
    }
  })
  return { outages, hole, days }
}
