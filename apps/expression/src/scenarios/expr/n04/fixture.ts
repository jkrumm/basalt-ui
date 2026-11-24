/**
 * Next 48 hours for a cyclist: hourly rain chance, wind and temperature, plus the rider's own
 * limits. Seeded and deterministic: keyframes per fixture, linear between them, a small seeded
 * jitter on top. `?fixture=storm` holds every hour over a limit (no window, a gale), `?fixture=clear`
 * holds none over (one window of all 48 hours, rain at zero).
 */

export type Cause = 'ride' | 'rain' | 'wind' | 'both'

export type Hour = {
  /** Hour index from the first hour, 0 to 47. */
  h: number
  at: Date
  /** Chance of rain, 0 to 100. */
  rain: number
  /** Wind, km/h. */
  wind: number
  /** Air temperature, degrees Celsius. */
  temp: number
  cause: Cause
}

/** A run of hours with one verdict; `from` and `to` are hour indexes, both inclusive. */
export type Stretch = {
  id: string
  cause: Cause
  from: number
  to: number
  start: Date
  end: Date
  hours: number
  peakRain: number
  peakWind: number
  minTemp: number
  maxTemp: number
}

/** The rider's own limits: a ride hour has rain chance and wind at or under both. */
export const LIMITS = { rain: 30, wind: 25 } as const

export const HOURS_SHOWN = 48
const START = Date.UTC(2026, 10, 20, 7)
const HOUR_MS = 3_600_000

type Keyframes = readonly (readonly [number, number])[]
type Weather = { seed: number; rain: Keyframes; wind: Keyframes; temp: Keyframes; jitter: number }

const FIXTURES: Record<string, Weather> = {
  rest: {
    seed: 7,
    jitter: 1,
    rain: [
      [0, 0],
      [3, 5],
      [4, 35],
      [5, 70],
      [7, 100],
      [11, 80],
      [15, 25],
      [17, 10],
      [22, 5],
      [24, 0],
      [29, 0],
      [31, 40],
      [33, 55],
      [34, 25],
      [35, 10],
      [38, 0],
      [41, 10],
      [44, 60],
      [47, 80],
    ],
    wind: [
      [0, 10],
      [3, 16],
      [4, 22],
      [6, 44],
      [8, 66],
      [11, 40],
      [14, 34],
      [18, 30],
      [22, 28],
      [23, 22],
      [24, 14],
      [29, 18],
      [31, 22],
      [33, 24],
      [34, 20],
      [36, 22],
      [38, 31],
      [41, 38],
      [47, 44],
    ],
    temp: [
      [0, 6],
      [6, 10],
      [11, 9],
      [14, 7],
      [22, 4],
      [24, 5],
      [30, 10],
      [34, 9],
      [40, 6],
      [47, 5],
    ],
  },
  storm: {
    seed: 11,
    jitter: 1,
    rain: [
      [0, 70],
      [10, 100],
      [30, 90],
      [47, 100],
    ],
    wind: [
      [0, 40],
      [6, 48],
      [20, 78],
      [30, 64],
      [47, 52],
    ],
    temp: [
      [0, 5],
      [20, 3],
      [47, 4],
    ],
  },
  clear: {
    seed: 3,
    jitter: 0,
    rain: [
      [0, 0],
      [26, 0],
      [28, 4],
      [30, 0],
      [47, 0],
    ],
    wind: [
      [0, 8],
      [12, 14],
      [24, 10],
      [36, 18],
      [47, 12],
    ],
    temp: [
      [0, 3],
      [12, 9],
      [24, 2],
      [36, 10],
      [47, 4],
    ],
  },
}

/** A small deterministic generator (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function at(frames: Keyframes, h: number): number {
  const next = frames.findIndex(([x]) => x >= h)
  const hi = frames[next]
  if (next <= 0 || hi === undefined) return frames[Math.max(next, 0)]?.[1] ?? 0
  const lo = frames[next - 1]
  if (lo === undefined) return hi[1]
  return lo[1] + ((hi[1] - lo[1]) * (h - lo[0])) / (hi[0] - lo[0])
}

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

function causeOf(rain: number, wind: number): Cause {
  const wet = rain > LIMITS.rain
  const windy = wind > LIMITS.wind
  if (wet && windy) return 'both'
  if (wet) return 'rain'
  return windy ? 'wind' : 'ride'
}

/** The 48 hours of a fixture; an unknown name is the rest fixture. */
export function hoursFor(fixture: string | undefined): readonly Hour[] {
  const w = FIXTURES[fixture ?? ''] ?? FIXTURES['rest']
  if (w === undefined) return []
  const next = seeded(w.seed)
  return Array.from({ length: HOURS_SHOWN }, (_, h) => {
    const wiggle = (): number => (next() - 0.5) * 2 * w.jitter
    const base = at(w.rain, h)
    const rain = clamp(Math.round(base === 0 ? 0 : base + wiggle() * 3), 0, 100)
    const wind = Math.max(0, Math.round(at(w.wind, h) + wiggle() * 2))
    const temp = Math.round((at(w.temp, h) + wiggle() * 0.6) * 10) / 10
    return { h, at: new Date(START + h * HOUR_MS), rain, wind, temp, cause: causeOf(rain, wind) }
  })
}

/** Runs of hours with one verdict, in time order. */
export function stretchesOf(hours: readonly Hour[]): readonly Stretch[] {
  const out: Stretch[] = []
  for (const hour of hours) {
    const last = out.at(-1)
    if (last !== undefined && last.cause === hour.cause) {
      last.to = hour.h
      last.end = new Date(hour.at.getTime() + HOUR_MS)
      last.hours += 1
      last.peakRain = Math.max(last.peakRain, hour.rain)
      last.peakWind = Math.max(last.peakWind, hour.wind)
      last.minTemp = Math.min(last.minTemp, hour.temp)
      last.maxTemp = Math.max(last.maxTemp, hour.temp)
      continue
    }
    out.push({
      id: `s${hour.h}`,
      cause: hour.cause,
      from: hour.h,
      to: hour.h,
      start: hour.at,
      end: new Date(hour.at.getTime() + HOUR_MS),
      hours: 1,
      peakRain: hour.rain,
      peakWind: hour.wind,
      minTemp: hour.temp,
      maxTemp: hour.temp,
    })
  }
  return out
}
