/**
 * The default Date x tick labels: chosen from the TICK step (not the data step), read in UTC like
 * the scale that placed them. A label may recur on one axis only behind a MARKER label (a day or a
 * year) — `12:00, 18:00, 18.10, 06:00, 12:00` is fine, `17.10, 17.10, 18.10` is not. Each span has
 * a ladder of levels, plainest first; the first level that holds the invariant wins. The last rung
 * of every ladder names the whole date (or instant) of its tick, so the invariant always holds.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const pad2 = (n: number): string => String(n).padStart(2, '0')

export const monthName = (d: Date): string => MONTHS[d.getUTCMonth()]!

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000
/**
 * Month ticks are 28–31 days apart; 27 days leaves slack for a consumer's uneven ticks while
 * keeping a 2-week step on the day ladder.
 */
const MONTH_STEP_MS = 27 * DAY_MS

/** `DD.MM`, read in UTC like the time scale (a local read shifts a day west of UTC). */
export function utcAxisDate(d: Date): string {
  return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}`
}

const utcClock = (d: Date): string => `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`
const utcClockSeconds = (d: Date): string => `${utcClock(d)}:${pad2(d.getUTCSeconds())}`
const utcClockMillis = (d: Date): string =>
  `${utcClockSeconds(d)}.${String(d.getUTCMilliseconds()).padStart(3, '0')}`
/** Two digits: a widened day label stays 8 characters and still reads as the `DD.MM` family. */
const utcAxisDateYear = (d: Date): string =>
  `${utcAxisDate(d)}.${String(d.getUTCFullYear()).slice(2)}`

const isMidnight = (t: number): boolean => t % DAY_MS === 0
const isJanuary = (d: Date): boolean => d.getUTCMonth() === 0
const dayOf = (t: number): number => Math.floor(t / DAY_MS)
const startsNewDay = (t: number, prev: number | undefined): boolean =>
  prev === undefined || dayOf(t) !== dayOf(prev)

type Label = { text: string; marker: boolean }
/** One label per tick time (ascending), as a whole: a label may depend on its predecessor. */
type Level = (times: readonly number[]) => Label[]

const marker = (text: string): Label => ({ text, marker: true })
const plain = (text: string): Label => ({ text, marker: false })
const each =
  (label: (t: number, d: Date, prev: number | undefined) => Label): Level =>
  (times) =>
    times.map((t, i) => label(t, new Date(t), times[i - 1]))

/** Under a day: `HH:MM`, a midnight tick carries the day. */
const subDayLevels: Level[] = [
  each((t, d) => (isMidnight(t) ? marker(utcAxisDate(d)) : plain(utcClock(d)))),
  // No midnight in reach: the first tick of each day carries its date instead.
  each((t, d, prev) =>
    isMidnight(t)
      ? marker(utcAxisDate(d))
      : startsNewDay(t, prev)
        ? marker(`${utcAxisDate(d)} ${utcClock(d)}`)
        : plain(utcClock(d)),
  ),
  each((_, d) => marker(`${utcAxisDate(d)} ${utcClock(d)}`)),
  // Sub-minute steps: the seconds, then (sub-second steps) the milliseconds. Every label names its
  // whole instant to the millisecond, and `dateTickFormat` dedupes ticks to the millisecond, so
  // the last rung cannot repeat.
  each((_, d) => marker(`${utcAxisDate(d)} ${utcClockSeconds(d)}`)),
  each((_, d) => marker(`${utcAxisDate(d)} ${utcClockMillis(d)}`)),
]

/**
 * A day or more: `DD.MM`. Ticks are at least a day apart here, so they fall on different UTC days
 * and the last rung, which names the full date, cannot repeat.
 */
const dayLevels: Level[] = [
  each((_, d) => marker(utcAxisDate(d))),
  each((_, d) => marker(utcAxisDateYear(d))),
]

/** A month or more: the month, a January tick carries the year. */
const monthLevels: Level[] = [
  each((_, d) => (isJanuary(d) ? marker(String(d.getUTCFullYear())) : plain(monthName(d)))),
  each((_, d) => marker(`${monthName(d)} ${d.getUTCFullYear()}`)),
  // Ticks a month apart in name only (Jan 1 and Jan 31): fall to the day ladder (ticks here are
  // >= 27 days apart, so its full-date last rung is unique).
  ...dayLevels,
]

/** A marker label is unique on the axis; any other label repeats only after a marker. */
function holdsInvariant(labels: readonly Label[]): boolean {
  const markers = new Set<string>()
  const since = new Set<string>()
  for (const { text, marker: isMarker } of labels) {
    if (isMarker ? markers.has(text) : since.has(text)) return false
    if (isMarker) {
      markers.add(text)
      since.clear()
    } else since.add(text)
  }
  return true
}

/** The first level whose labels hold the invariant, else the last (see each ladder's last rung). */
function pickLabels(levels: readonly Level[], times: readonly number[]): Label[] {
  let labels: Label[] = []
  for (const level of levels) {
    labels = level(times)
    if (holdsInvariant(labels)) return labels
  }
  return labels
}

/**
 * The tick step: the smallest gap between ticks. One tick has no gap, so it takes the span its own
 * instant implies: a midnight is a day, anything else is read as a clock time.
 */
function stepOf(times: readonly number[]): number {
  if (times.length === 1) return isMidnight(times[0]!) ? DAY_MS : HOUR_MS
  return times.reduce((min, t, i) => (i === 0 ? min : Math.min(min, t - times[i - 1]!)), Infinity)
}

/**
 * A formatter for one tick set. A Date that is not among the ticks (a hover, a consumer reading
 * the axis format) reads as plain `DD.MM`: its position in the set is undefined.
 */
export function dateTickFormat(ticks: readonly Date[]): (d: Date) => string {
  const times = [...new Set(ticks.map((t) => t.getTime()))].toSorted((a, b) => a - b)
  const step = stepOf(times)
  const levels = step < DAY_MS ? subDayLevels : step < MONTH_STEP_MS ? dayLevels : monthLevels
  const text = new Map(pickLabels(levels, times).map((l, i) => [times[i]!, l.text]))
  return (d) => text.get(d.getTime()) ?? utcAxisDate(d)
}
