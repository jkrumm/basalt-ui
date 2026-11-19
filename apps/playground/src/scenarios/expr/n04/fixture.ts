/**
 * A seeded 48-hour forecast for the ride question: hourly rain chance, wind and temperature from a
 * fixed start, plus the cyclist's two personal limits. `forecastFor` takes the `?fixture=` name:
 * `mixed` (the default) has a front each day, a wind-only night, a one-hour rain blip and a 58 km/h
 * gust; `wet` never gets under the rain limit; `clear` is dry and calm all 48 hours.
 */

const HOUR = 3_600_000
/** Friday 20 Nov 2026, 06:00 UTC: the forecast's first hour. */
const START = Date.UTC(2026, 10, 20, 6)

export const RAIN_LIMIT = 30
export const WIND_LIMIT = 25
/** A ride is worth the kit-up from this many hours. */
export const MIN_WINDOW_HOURS = 2
/** When the model run behind the fixture was issued. */
export const ISSUED_AT = new Date(Date.UTC(2026, 10, 20, 5))

export type Hour = { at: Date; rain: number; wind: number; temp: number }
export type RideWindow = {
  id: string
  from: Date
  /** The start of the window's last hour. */
  to: Date
  hours: number
  rainMax: number
  windMax: number
  tempAvg: number
}
export type ForecastName = 'mixed' | 'wet' | 'clear'
export type Forecast = {
  name: ForecastName
  hours: readonly Hour[]
  windows: readonly RideWindow[]
}

type Front = { centre: number; width: number; rain: number; wind: number; temp: number }
type Recipe = { seed: number; fronts: readonly Front[]; rainFloor: number; rainNoise: number }

const RECIPES: Record<ForecastName, Recipe> = {
  mixed: {
    seed: 48,
    rainFloor: 0,
    rainNoise: 6,
    fronts: [
      { centre: 9.5, width: 3, rain: 90, wind: 10, temp: -2 },
      { centre: 21, width: 5.5, rain: 0, wind: 29, temp: -1 },
      { centre: 30, width: 1.1, rain: 36, wind: 0, temp: 0 },
      { centre: 42, width: 3.2, rain: 92, wind: 20, temp: -3 },
    ],
  },
  wet: {
    seed: 7,
    rainFloor: 34,
    rainNoise: 8,
    fronts: [
      { centre: 12, width: 8, rain: 92, wind: 14, temp: -2 },
      { centre: 38, width: 9, rain: 88, wind: 16, temp: -3 },
    ],
  },
  clear: { seed: 11, rainFloor: 0, rainNoise: 0, fronts: [] },
}

const isForecastName = (name: string | undefined): name is ForecastName =>
  name === 'mixed' || name === 'wet' || name === 'clear'

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function buildHours(name: ForecastName): Hour[] {
  const { seed, fronts, rainFloor, rainNoise } = RECIPES[name]
  const random = mulberry32(seed)
  const hours = Array.from({ length: 48 }, (_, i): Hour => {
    const clock = (6 + i) % 24
    const reach = (f: Front) => Math.exp(-(((i - f.centre) / f.width) ** 2))
    const rain = Math.max(0, ...fronts.map((f) => f.rain * reach(f)), rainFloor)
    const windFronts = fronts.reduce((sum, f) => sum + f.wind * reach(f), 0)
    const tempFronts = fronts.reduce((sum, f) => sum + f.temp * reach(f), 0)
    const noisyRain = Math.round(rain + random() * rainNoise - rainNoise / 4)
    const wind = 6 + 7 * Math.max(0, Math.sin(((clock - 8) / 24) * 2 * Math.PI)) + windFronts
    const temp = 7 + 5 * Math.sin(((clock - 9) / 24) * 2 * Math.PI) + tempFronts
    return {
      at: new Date(START + i * HOUR),
      rain: noisyRain < 5 ? 0 : Math.min(100, noisyRain),
      wind: Math.round(wind + random() * 4),
      temp: Math.round(temp + random() - 0.5),
    }
  })
  if (name === 'mixed') hours[40] = { ...hours[40]!, wind: 58 }
  if (name === 'clear') hours[22] = { ...hours[22]!, wind: 0 }
  return hours
}

/** The end of a window: the start of the hour after its last hour. */
export const windowEnd = (w: RideWindow): Date => new Date(w.to.getTime() + HOUR)

export const isRideHour = (h: Hour): boolean => h.rain <= RAIN_LIMIT && h.wind <= WIND_LIMIT

/** Every run of ride hours of at least `MIN_WINDOW_HOURS`, in time order. */
function windowsOf(hours: readonly Hour[]): RideWindow[] {
  const runs: Hour[][] = []
  let open: Hour[] = []
  for (const h of hours) {
    if (isRideHour(h)) {
      open.push(h)
      continue
    }
    if (open.length > 0) runs.push(open)
    open = []
  }
  if (open.length > 0) runs.push(open)
  return runs
    .filter((run) => run.length >= MIN_WINDOW_HOURS)
    .map((run) => ({
      id: `w-${run[0]!.at.getTime()}`,
      from: run[0]!.at,
      to: run.at(-1)!.at,
      hours: run.length,
      rainMax: Math.max(...run.map((h) => h.rain)),
      windMax: Math.max(...run.map((h) => h.wind)),
      tempAvg: Math.round(run.reduce((sum, h) => sum + h.temp, 0) / run.length),
    }))
}

/** The forecast for a `?fixture=` name; an unknown or missing name is `mixed`. */
export function forecastFor(fixture: string | undefined): Forecast {
  const name = isForecastName(fixture) ? fixture : 'mixed'
  const hours = buildHours(name)
  return { name, hours, windows: windowsOf(hours) }
}
