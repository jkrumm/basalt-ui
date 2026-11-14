/**
 * n01 fixture: a household's internet line over 30 days. Outage intervals, hourly down and up
 * speed samples and the contracted rate. Fixed "today" (no clock), seeded noise, all UTC.
 *
 * `FIXTURE_NAMES`: `line` (default: eight outages, the longest 6 h 40 min across midnight, a
 * degraded stretch and evening dips) and `clean` (zero outages, speed holds).
 */
import { fmtDay, seeded } from '../../fixture-utils'

export const FIXTURE_NAMES = ['line', 'clean'] as const
export type FixtureName = (typeof FIXTURE_NAMES)[number]

const MIN = 60_000
const HOUR = 60 * MIN
const DAY = 24 * HOUR
const DAYS = 30

/** The fixed "today": the window ends at midnight UTC on this instant. */
export const NOW = Date.UTC(2026, 10, 14, 0, 0)
export const WINDOW_START = NOW - DAYS * DAY

export const CONTRACT_DOWN = 250
export const CONTRACT_UP = 50
/** A sample counts as holding the rate from this share of the contract up. */
export const HOLD_SHARE = 0.9
/** The availability the household expects of the line. */
export const AVAILABILITY_TARGET = 99.9

export type Outage = { id: string; start: Date; end: Date; minutes: number }
export type Sample = {
  at: Date
  down: number
  up: number
  /** Percent of the contracted rate, one decimal. */
  downPct: number
  upPct: number
}
/** One UTC day of the speed samples: the median hour, as a share of the contract and in Mbit/s. */
export type DaySpeed = {
  day: Date
  downPct: number
  upPct: number
  down: number
  up: number
}
export type DayDowntime = { label: string; day: Date; minutes: number; outages: number }

/** [day of the window, hour, minute, minutes down]. */
const OUTAGE_ROWS: readonly (readonly [number, number, number, number])[] = [
  [2, 3, 12, 4],
  [6, 21, 40, 11],
  [9, 14, 5, 38],
  [13, 2, 30, 7],
  [17, 19, 50, 95],
  [21, 8, 15, 22],
  [24, 0, 45, 6],
  [27, 20, 20, 400],
]

const toOutage = ([day, hour, minute, minutes]: readonly [
  number,
  number,
  number,
  number,
]): Outage => {
  const start = WINDOW_START + day * DAY + hour * HOUR + minute * MIN
  return {
    id: `outage-${day}-${hour}-${minute}`,
    start: new Date(start),
    end: new Date(start + minutes * MIN),
    minutes,
  }
}

const overlap = (o: Outage, from: number, to: number): number =>
  Math.max(0, Math.min(o.end.getTime(), to) - Math.max(o.start.getTime(), from))

const round1 = (v: number): number => Math.round(v * 10) / 10

const median = (values: readonly number[]): number =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0

export type LineFixture = {
  outages: readonly Outage[]
  samples: readonly Sample[]
  days: readonly DayDowntime[]
  totalMinutes: number
  longest: Outage | undefined
  /** Share of the window the line was up, 0..1. */
  availability: number
  medianDown: number
  /** Hours whose download sat under the hold share of the contract (an outage hour counts). */
  hoursBelow: number
  /** Axis top of the downtime chart, a whole number of hours in minutes. */
  dayAxisMax: number
  worstDay: DayDowntime | undefined
  speedDays: readonly DaySpeed[]
  medianUp: number
  /** Share of hours at or above the hold share of the contract, 0..1. */
  holdShare: number
  /** The y range that fits the daily medians, the 90 % and 100 % rules and their labels. */
  speedDomain: readonly [number, number]
  /** Median outage length in minutes (0 without outages). */
  medianOutage: number
  /** The 30 days before the window, the baseline of the drops and the time down. */
  previous: { outages: number; minutes: number }
  /** The degraded stretch (a line fault): its first and last hour and its mean share of the contract. */
  degraded: { from: Date; to: Date; meanPct: number } | undefined
}

function build(name: FixtureName): LineFixture {
  const outages = (name === 'clean' ? [] : OUTAGE_ROWS).map(toOutage)
  const rand = seeded(name === 'clean' ? 7 : 1104)
  const samples: Sample[] = Array.from({ length: DAYS * 24 }, (_, i) => {
    const t = WINDOW_START + i * HOUR
    const day = Math.floor(i / 24)
    const hour = i % 24
    const evening = hour >= 19 && hour <= 22
    const degraded = name === 'line' && day >= 10 && day <= 12
    let downShare = 0.97 + rand() * 0.06
    if (evening) downShare -= name === 'clean' ? 0.03 + rand() * 0.03 : 0.1 + rand() * 0.1
    if (degraded) downShare = 0.5 + rand() * 0.14
    const upShare = 0.98 + rand() * 0.05 - (evening ? 0.04 : 0)
    const downFraction = outages.reduce((sum, o) => sum + overlap(o, t, t + HOUR), 0) / HOUR
    const down = round1(CONTRACT_DOWN * downShare * (1 - downFraction))
    const up = round1(CONTRACT_UP * upShare * (1 - downFraction))
    return {
      at: new Date(t),
      down,
      up,
      downPct: round1((down / CONTRACT_DOWN) * 100),
      upPct: round1((up / CONTRACT_UP) * 100),
    }
  })
  const days: DayDowntime[] = Array.from({ length: DAYS }, (_, d) => {
    const from = WINDOW_START + d * DAY
    const touching = outages.filter((o) => overlap(o, from, from + DAY) > 0)
    const ms = touching.reduce((sum, o) => sum + overlap(o, from, from + DAY), 0)
    return {
      label: fmtDay(new Date(from)),
      day: new Date(from),
      minutes: Math.round(ms / MIN),
      outages: touching.length,
    }
  })
  const speedDays: DaySpeed[] = Array.from({ length: DAYS }, (_, d) => {
    const hours = samples.slice(d * 24, d * 24 + 24)
    const down = median(hours.map((h) => h.down))
    const up = median(hours.map((h) => h.up))
    return {
      day: new Date(WINDOW_START + d * DAY),
      down,
      up,
      downPct: round1((down / CONTRACT_DOWN) * 100),
      upPct: round1((up / CONTRACT_UP) * 100),
    }
  })
  const lowest = Math.min(HOLD_SHARE * 100, ...speedDays.map((d) => d.downPct))
  const sortedDown = samples.map((s) => s.down).toSorted((a, b) => a - b)
  const totalMinutes = outages.reduce((sum, o) => sum + o.minutes, 0)
  const longest = outages.reduce<Outage | undefined>(
    (best, o) => (best === undefined || o.minutes > best.minutes ? o : best),
    undefined,
  )
  const peak = Math.max(0, ...days.map((d) => d.minutes))
  const stretch = samples.filter((s) => {
    const day = Math.floor((s.at.getTime() - WINDOW_START) / DAY)
    return name === 'line' && day >= 10 && day <= 12
  })
  const first = stretch[0]
  const last = stretch.at(-1)
  return {
    outages,
    samples,
    days,
    totalMinutes,
    longest,
    availability: 1 - totalMinutes / (DAYS * 24 * 60),
    medianDown: sortedDown[Math.floor(sortedDown.length / 2)] ?? 0,
    hoursBelow: samples.filter((s) => s.down < CONTRACT_DOWN * HOLD_SHARE).length,
    speedDays,
    medianUp: median(samples.map((s) => s.up)),
    holdShare:
      1 - samples.filter((s) => s.down < CONTRACT_DOWN * HOLD_SHARE).length / samples.length,
    speedDomain: [Math.floor((lowest - 10) / 10) * 10, 110],
    medianOutage: median(outages.map((o) => o.minutes)),
    dayAxisMax: Math.max(1, Math.ceil(peak / 60)) * 60,
    worstDay: peak === 0 ? undefined : days.find((d) => d.minutes === peak),
    previous: name === 'clean' ? { outages: 1, minutes: 9 } : { outages: 5, minutes: 142 },
    degraded:
      first === undefined || last === undefined
        ? undefined
        : {
            from: first.at,
            to: last.at,
            meanPct: round1(stretch.reduce((sum, s) => sum + s.downPct, 0) / stretch.length),
          },
  }
}

export const FIXTURES: Record<FixtureName, LineFixture> = {
  line: build('line'),
  clean: build('clean'),
}

export const isFixtureName = (value: unknown): value is FixtureName =>
  FIXTURE_NAMES.some((n) => n === value)

/** "6 h 40 min", "38 min", "2 h". */
export function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export const fmtClock = (d: Date): string =>
  `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`

export const fmtStamp = (d: Date): string => `${fmtDay(d)}, ${fmtClock(d)}`

export const WINDOW_LABEL = `${fmtDay(new Date(WINDOW_START))} to ${fmtDay(new Date(NOW - DAY))}`
