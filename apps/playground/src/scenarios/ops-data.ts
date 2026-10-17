/**
 * S1 fixture data: seven days of an internet line, shaped like linewatch — hourly latency (ms),
 * packet loss (%) and download/upload throughput (Mbit/s) against a contracted ceiling, the last
 * hour per minute, a list of outages and the up/down transitions they imply. Deterministic: the
 * seeded generator runs once at module load and the reading time is fixed, so a re-render, a reload
 * and a screenshot read the same numbers.
 */
import { fmtDay, itemAt, seeded } from './fixture-utils'

export type OutageCause = 'Modem reboot' | 'ISP upstream fault' | 'Line retrain'

/** The reading time. Fixed, so "last 24 h" and "last outage" never move under a screenshot. */
const NOW = Date.UTC(2026, 9, 16, 12, 0)
const MIN_MS = 60_000
const HOUR_MS = 3_600_000
export const WINDOW_HOURS = 168
const WINDOW_START = NOW - WINDOW_HOURS * HOUR_MS

export const CONTRACT_DOWN_MBIT = 250
const CONTRACT_UP_MBIT = 40

export const NOW_DATE = new Date(NOW)

/** Hours and minutes after the window start, so the schedule reads as a list of facts. */
const at = (hours: number, minutes: number): number =>
  WINDOW_START + hours * HOUR_MS + minutes * MIN_MS

export type Outage = {
  start: Date
  end: Date
  minutes: number
  cause: OutageCause
}

const outage = (startMs: number, minutes: number, cause: OutageCause): Outage => ({
  start: new Date(startMs),
  end: new Date(startMs + minutes * MIN_MS),
  minutes,
  cause,
})

/** Oldest first. */
const OUTAGES_ASC: readonly Outage[] = [
  outage(at(20, 5), 9, 'Modem reboot'),
  outage(at(71, 40), 47, 'ISP upstream fault'),
  outage(at(118, 12), 6, 'Line retrain'),
  outage(at(141, 30), 23, 'ISP upstream fault'),
]

/** Newest first — the order a person asks "when did it last break" in. */
export const OUTAGES: readonly Outage[] = OUTAGES_ASC.toSorted(
  (a, b) => b.start.getTime() - a.start.getTime(),
)
export const LAST_OUTAGE: Outage = itemAt(OUTAGES, 0)

export type Transition = { at: Date; to: 'down' | 'up'; cause: OutageCause }

/** Every outage as a pair of state changes, newest first — the data the event list (Wave 37) reads. */
export const TRANSITIONS: readonly Transition[] = OUTAGES.flatMap((o) => [
  { at: o.end, to: 'up' as const, cause: o.cause },
  { at: o.start, to: 'down' as const, cause: o.cause },
])

/** Hours where the line was up but slow and lossy, apart from the outages. */
const DEGRADED_HOURS = new Set([44, 45, 96, 130])

const downMinutesIn = (startMs: number): number =>
  OUTAGES_ASC.reduce((total, o) => {
    const overlap =
      Math.min(o.end.getTime(), startMs + HOUR_MS) - Math.max(o.start.getTime(), startMs)
    return total + Math.max(0, overlap) / MIN_MS
  }, 0)

export type HourRow = {
  start: Date
  /** Median round-trip to the probe target. `null` when any of the hour was down. */
  latencyMs: number | null
  lossPct: number
  downMbit: number | null
  upMbit: number | null
  downMinutes: number
}

const random = seeded(2026_10_16)

export const HOURLY: readonly HourRow[] = Array.from({ length: WINDOW_HOURS }, (_, i) => {
  const startMs = WINDOW_START + i * HOUR_MS
  const start = new Date(startMs)
  const downMinutes = downMinutesIn(startMs)
  const degraded = DEGRADED_HOURS.has(i)
  const hour = start.getUTCHours()
  // Evening congestion (19–23 h) lifts latency and costs throughput.
  const evening = hour >= 19 && hour <= 23 ? 1 : 0
  const wentDown = downMinutes > 0
  const latency = 13 + evening * 6 + random() * 4 + (degraded ? 38 : 0)
  const loss = random() * 0.3 + (degraded ? 2.4 + random() : 0) + (downMinutes / 60) * 100
  const down = CONTRACT_DOWN_MBIT * (0.93 - evening * 0.12 + random() * 0.05)
  const up = CONTRACT_UP_MBIT * (0.94 - evening * 0.04 + random() * 0.04)
  return {
    start,
    latencyMs: wentDown ? null : latency,
    lossPct: Math.min(100, loss),
    downMbit: wentDown ? null : down,
    upMbit: wentDown ? null : up,
    downMinutes,
  }
})

export type LineState = 'up' | 'degraded' | 'down'

/** Loss at which an hour counts as degraded rather than up. */
export const DEGRADED_LOSS_PCT = 1

export const lineState = (row: HourRow): LineState => {
  if (row.downMinutes > 0) return 'down'
  return row.lossPct >= DEGRADED_LOSS_PCT ? 'degraded' : 'up'
}

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)
const mean = (values: readonly number[]): number => sum(values) / values.length
const present = (values: readonly (number | null)[]): number[] =>
  values.filter((v): v is number => v !== null)
const median = (values: readonly number[]): number => {
  const sorted = values.toSorted((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2
    ? itemAt(sorted, mid)
    : (itemAt(sorted, mid - 1) + itemAt(sorted, mid)) / 2
}

export const DOWNTIME_MINUTES = sum(OUTAGES.map((o) => o.minutes))
export const UPTIME_PCT = (1 - DOWNTIME_MINUTES / (WINDOW_HOURS * 60)) * 100

const LAST_DAY = HOURLY.slice(-24)
export const LOSS_24H_PCT = mean(LAST_DAY.map((h) => h.lossPct))
/** Hourly loss and download over the last 24 hours, oldest first — the metric cards' sparklines. */
export const LOSS_24H_SERIES: readonly number[] = LAST_DAY.map((h) => h.lossPct)
// An hour with no reading is a gap (NaN), not a missing point: the sparkline keeps the hour's slot.
export const DOWN_24H_SERIES: readonly number[] = LAST_DAY.map((h) => h.downMbit ?? Number.NaN)
export const LOSS_7D_PCT = mean(HOURLY.map((h) => h.lossPct))
export const DOWN_24H_MBIT = mean(present(LAST_DAY.map((h) => h.downMbit)))
export const DOWN_PEAK_MBIT = Math.max(...present(HOURLY.map((h) => h.downMbit)))
export const LATENCY_MEDIAN_7D_MS = median(present(HOURLY.map((h) => h.latencyMs)))

/** The last 60 minutes, oldest first — the metric card's sparkline and its figure. */
export const MINUTE_LATENCY: readonly number[] = (() => {
  const minuteRandom = seeded(2026_10_17)
  return Array.from({ length: 60 }, (_, i) => 15 + minuteRandom() * 5 + (i === 41 ? 14 : 0))
})()
export const LATENCY_NOW_MS = itemAt(MINUTE_LATENCY, -1)

export type LatencyBin = { from: number; label: string; hours: number }

export const LATENCY_BIN_MS = 4

/** Hours by median latency, in `LATENCY_BIN_MS` bins — the shape of a normal hour and how heavy the tail is. */
export const LATENCY_DISTRIBUTION: readonly LatencyBin[] = (() => {
  const values = present(HOURLY.map((h) => h.latencyMs))
  const first = Math.floor(Math.min(...values) / LATENCY_BIN_MS) * LATENCY_BIN_MS
  const last = Math.floor(Math.max(...values) / LATENCY_BIN_MS) * LATENCY_BIN_MS
  const bins: LatencyBin[] = []
  for (let from = first; from <= last; from += LATENCY_BIN_MS) {
    bins.push({
      from,
      label: `${from}`,
      hours: values.filter((v) => v >= from && v < from + LATENCY_BIN_MS).length,
    })
  }
  return bins
})()

/** Hours with a latency reading — the outage hours have none and are not binned. */
export const MEASURED_HOURS = HOURLY.filter((h) => h.latencyMs !== null).length

/** Headroom above the contracted download so the ceiling line is not clipped by the plot edge. */
export const CEILING_HEADROOM_MBIT = 10

export const fmtMs = (value: number): string => `${Math.round(value)} ms`
export const fmtMbit = (value: number): string => `${Math.round(value)} Mbit/s`
export const fmtLoss = (value: number): string => `${value.toFixed(2)}%`
export const fmtUptime = (value: number): string => `${value.toFixed(2)}%`
export const fmtDuration = (minutes: number): string => `${minutes} min`
export const fmtStamp = (date: Date): string =>
  date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  })
export const WINDOW_LABEL = `${fmtDay(new Date(WINDOW_START))}–${fmtDay(NOW_DATE)}`
