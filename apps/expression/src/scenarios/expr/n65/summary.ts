import { CLASSES, commitTotal, ended } from './fixture'
import type { ClassKey, Data, Day, Reason, Week } from './fixture'

/** The count of reasons the table plans for while loading. */
export const REASON_COUNT = 12

/** A signed whole number with a true minus; zero is bare. */
export const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `\u2212${-n}` : '0')

export const doneShare = (w: Week): number =>
  ended(w) === 0 ? 0 : Math.round((100 * w.done) / ended(w))
export const droppedShare = (w: Week): number =>
  ended(w) === 0 ? 0 : Math.round((100 * w.dropped) / ended(w))

export const leaderOf = (w: Week): ClassKey =>
  CLASSES.reduce((best, k) => (w.commits[k] > w.commits[best] ? k : best), CLASSES[0])

const mean = (xs: readonly number[]): number =>
  xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length

const weekDays = (days: readonly Day[], fromEnd: number): readonly Day[] =>
  days.slice(days.length - 7 * (fromEnd + 1), days.length - 7 * fromEnd)

export type Summary = {
  riser: Reason
  /** Reasons whose count rose. */
  up: number
  /** Reasons whose count fell. */
  falling: number
  weekdayMean: number
  weekendMean: number
  commitMean: number
  gateShare: number
  bestShare: Week
  now: Week
  before: Week
  mostDropped: Week
  fewestOpen: Week
  idleNow: number
  idleBefore: number
  mostIdle: Day
  zeroIdle: Day | undefined
}

/** Every figure the page states, from rows that exist; `undefined` while there are none. */
export function summarise(data: Data): Summary | undefined {
  const [riser] = data.reasons
  const now = data.weeks.at(-1)
  const before = data.weeks.at(-2)
  const mostIdle = data.days.toSorted((a, b) => b.idle - a.idle)[0]
  if (!riser || !now || !before || !mostIdle) return undefined
  const byDropped = data.weeks.toSorted((a, b) => b.dropped - a.dropped)
  const byOpen = data.weeks.toSorted((a, b) => a.open - b.open)
  return {
    riser,
    up: data.reasons.filter((r) => r.change > 0).length,
    falling: data.reasons.filter((r) => r.change < 0).length,
    weekdayMean: mean(data.days.filter((d) => !d.weekend).map((d) => d.idle)),
    weekendMean: mean(data.days.filter((d) => d.weekend).map((d) => d.idle)),
    commitMean: mean(data.weeks.map(commitTotal)),
    gateShare: Math.round((100 * now.commits.gate) / commitTotal(now)),
    bestShare: data.weeks.toSorted((a, b) => doneShare(b) - doneShare(a))[0] ?? now,
    now,
    before,
    mostDropped: byDropped[0] ?? now,
    fewestOpen: byOpen[0] ?? now,
    idleNow: mean(weekDays(data.days, 0).map((d) => d.idle)),
    idleBefore: mean(weekDays(data.days, 1).map((d) => d.idle)),
    mostIdle,
    zeroIdle: data.days.find((d) => d.idle === 0),
  }
}
