import type { Format } from 'basalt-ui'
import { MODELS, type ModelKey, type Reading } from './fixture'

/** A night runs from 18:00 to 08:00 in the page's zone (UTC in the playground). */
const NIGHT_FROM = 18
const NIGHT_TO = 8
const NIGHT_LENGTH = 24 - NIGHT_FROM + NIGHT_TO
const HOUR = 3_600_000

/** One forecast hour with what the page reads off it. */
export type Hour = Reading & {
  /** Median air temperature of the three models, °C: the forecast the answer is read from. */
  median: number
  dewMedian: number
  /** How many models read below 0 °C this hour. */
  below: number
  /** The stretch of hours it sits in ('Thu night', 'Fri day'): PageUp and PageDown step by it. */
  part: string
}

export type Run = { from: Date; to: Date; hours: number }

export type Night = {
  id: string
  /** 'Thu': the weekday its evening falls on. */
  day: string
  /** 'Thu night': the night that starts on Thursday evening. */
  name: string
  from: Date
  to: Date
  hours: readonly Hour[]
  /** The median forecast at the coldest hour of the night, °C. */
  lowest: number
  lowestAt: Date
  dewAtLowest: number
  /** Hours the median forecast reads below 0 °C. */
  frostHours: number
  /** Each unbroken stretch below 0 °C, from its first hour to the end of its last. */
  runs: readonly Run[]
  /** How many models dip below 0 °C at any hour of the night, 0 to 3. */
  models: number
  /** Hours each model reads below 0 °C. */
  hoursBy: Record<ModelKey, number>
}

export type Forecast = {
  hours: readonly Hour[]
  nights: readonly Night[]
  /** Nights with at least one hour below 0 °C in the median forecast. */
  frostNights: readonly Night[]
  longest: Night | undefined
  coldest: Night | undefined
  /** The model furthest from the mean of the other two, and its mean gap to them, °C. */
  outlier: { model: ModelKey; gap: number }
}

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length

const median3 = (a: number, b: number, c: number): number =>
  [a, b, c].toSorted((x, y) => x - y)[1] ?? a

/** How far `model` reads above the mean of the other two at one hour, °C. */
export function gapAt(reading: Pick<Reading, 'temp'>, model: ModelKey): number {
  const others = MODELS.filter((m) => m !== model).map((m) => reading.temp[m])
  return reading.temp[model] - mean(others)
}

/** The UTC midnight of the date a night's evening falls on, or `null` for an hour of daylight. */
function eveningOf(at: Date): number | null {
  const hour = at.getUTCHours()
  const midnight = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate())
  if (hour >= NIGHT_FROM) return midnight
  if (hour < NIGHT_TO) return midnight - 24 * HOUR
  return null
}

function runsOf(hours: readonly Hour[]): Run[] {
  const runs: Run[] = []
  let open: Hour[] = []
  const close = () => {
    const first = open[0]
    const last = open.at(-1)
    if (first !== undefined && last !== undefined) {
      runs.push({ from: first.at, to: new Date(last.at.getTime() + HOUR), hours: open.length })
    }
    open = []
  }
  for (const hour of hours) {
    if (hour.median < 0) open.push(hour)
    else close()
  }
  close()
  return runs
}

function nightOf(evening: number, hours: readonly Hour[], dayName: (d: Date) => string): Night {
  const from = new Date(evening + NIGHT_FROM * HOUR)
  const coldest = hours.reduce((a, b) => (b.median < a.median ? b : a))
  const runs = runsOf(hours)
  const below = (m: ModelKey): number => hours.filter((h) => h.temp[m] < 0).length
  return {
    id: `night-${from.getTime()}`,
    day: dayName(new Date(evening)),
    name: `${dayName(new Date(evening))} night`,
    from,
    to: new Date(from.getTime() + NIGHT_LENGTH * HOUR),
    hours,
    lowest: coldest.median,
    lowestAt: coldest.at,
    dewAtLowest: coldest.dewMedian,
    frostHours: runs.reduce((sum, r) => sum + r.hours, 0),
    runs,
    models: MODELS.filter((m) => hours.some((h) => h.temp[m] < 0)).length,
    hoursBy: { ecmwf: below('ecmwf'), gfs: below('gfs'), icon: below('icon') },
  }
}

export function buildForecast(readings: readonly Reading[], f: Format): Forecast {
  const dayName = (d: Date): string => f.date(d, 'weekday')
  const byEvening = new Map<number, Hour[]>()
  const hours = readings.map((r): Hour => {
    const evening = eveningOf(r.at)
    const hour: Hour = {
      ...r,
      median: median3(r.temp.ecmwf, r.temp.gfs, r.temp.icon),
      dewMedian: median3(r.dew.ecmwf, r.dew.gfs, r.dew.icon),
      below: MODELS.filter((m) => r.temp[m] < 0).length,
      part: evening === null ? `${dayName(r.at)} day` : `${dayName(new Date(evening))} night`,
    }
    if (evening !== null) byEvening.set(evening, [...(byEvening.get(evening) ?? []), hour])
    return hour
  })
  const nights = [...byEvening].map(([evening, nightHours]) =>
    nightOf(evening, nightHours, dayName),
  )
  const frostNights = nights.filter((n) => n.frostHours > 0)
  const gaps = MODELS.map((model) => ({ model, gap: mean(readings.map((r) => gapAt(r, model))) }))
  const outlier = gaps.reduce((a, b) => (Math.abs(b.gap) > Math.abs(a.gap) ? b : a))
  return {
    hours,
    nights,
    frostNights,
    longest: frostNights.reduce<Night | undefined>(
      (a, b) => (a === undefined || b.frostHours > a.frostHours ? b : a),
      undefined,
    ),
    coldest: nights.reduce<Night | undefined>(
      (a, b) => (a === undefined || b.lowest < a.lowest ? b : a),
      undefined,
    ),
    outlier,
  }
}
