/** Seeded 48-hour forecast for expr-n04: rain chance, wind and temperature per hour, plus the rider's limits. */

export type Hour = {
  /** Hours since the forecast start. */
  i: number
  rain: number
  wind: number
  temp: number
}

export type Limits = { rain: number; wind: number }

export type Forecast = { hours: readonly Hour[]; limits: Limits }

/** The forecast starts Monday 23:00, nine hours into the pattern below. */
const START_HOUR = 23
const PATTERN_OFFSET = 9
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu'] as const

const LIMITS: Limits = { rain: 30, wind: 20 }

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const bump = (i: number, centre: number, width: number): number =>
  Math.exp(-(((i - centre) / width) ** 2))

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** Clock text of an hour index; `i` may be one past the end (an exclusive end). */
export function clock(i: number): { day: string; time: string } {
  const abs = START_HOUR + i
  return { day: DAYS[Math.floor(abs / 24)] ?? '', time: `${String(abs % 24).padStart(2, '0')}:00` }
}

export const hourLabel = (i: number): string => {
  const { day, time } = clock(i)
  return `${day} ${time}`
}

/** `Tue 07:00–13:00`, or `Mon 22:00–Tue 06:00` across midnight. */
function spanLabel(from: number, toExclusive: number): string {
  const a = clock(from)
  const b = clock(toExclusive)
  return a.day === b.day ? `${a.day} ${a.time}–${b.time}` : `${a.day} ${a.time}–${b.day} ${b.time}`
}

function shortSpan(from: number, toExclusive: number): string {
  const a = clock(from)
  const b = clock(toExclusive)
  const hh = (time: string): string => time.slice(0, 2)
  return a.day === b.day
    ? `${a.day} ${hh(a.time)}–${hh(b.time)}`
    : `${a.day} ${hh(a.time)}–${b.day} ${hh(b.time)}`
}

function build(kind: string | undefined): Forecast {
  const noise = seeded(404)
  const hours = Array.from({ length: 48 }, (_, i): Hour => {
    const jitter = noise()
    const diurnal = Math.sin(((START_HOUR + i - 9) / 24) * Math.PI * 2)
    const temp = Math.round(8 + 3.5 * diurnal + jitter * 1.2)
    if (kind === 'still') return { i, rain: 0, wind: 0, temp }
    if (kind === 'storm') {
      return {
        i,
        rain: clamp(Math.round(72 + jitter * 28), 0, 100),
        wind: Math.round(34 + jitter * 28 + 6 * bump(i, 20, 6)),
        temp: temp - 3,
      }
    }
    const t = i + PATTERN_OFFSET
    const rain =
      92 * bump(t, 5, 3.2) + 70 * bump(t, 31, 3.4) + 78 * bump(t, 15, 1.8) + 46 * bump(t, 41, 1.6)
    const wind =
      8 +
      31 * bump(t, 4, 4.5) +
      24 * bump(t, 30, 4) +
      15 * bump(t, 39, 2.2) +
      20 * bump(t, 52, 2.5) +
      jitter * 3
    return {
      i,
      rain: rain + jitter * 8 < 4 ? 0 : clamp(Math.round(rain + jitter * 8), 0, 100),
      wind: Math.round(wind),
      temp,
    }
  })
  return { hours, limits: LIMITS }
}

export const forecastFor = (fixture: string | undefined): Forecast => build(fixture)

export const isRide = (h: Hour, limits: Limits): boolean =>
  h.rain <= limits.rain && h.wind <= limits.wind

export type Run = {
  /** Unique per run and spoken as the focus group name: `Ride Tue 07:00–17:00`. */
  id: string
  ride: boolean
  from: number
  /** Index of the last hour in the run. */
  to: number
  label: string
  /** `Tue 07–17`: the hero's compact form. */
  short: string
  hours: number
  maxWind: number
  maxRain: number
  minTemp: number
  maxTemp: number
}

/** The whole forecast as alternating ride and skip runs; items of a run are contiguous. */
export function runsOf(hours: readonly Hour[], limits: Limits): Run[] {
  const runs: Run[] = []
  let from = 0
  hours.forEach((h, k) => {
    const next = hours[k + 1]
    if (next !== undefined && isRide(next, limits) === isRide(h, limits)) return
    const part = hours.slice(from, k + 1)
    const ride = isRide(h, limits)
    runs.push({
      id: `${ride ? 'Ride' : 'Skip'} ${spanLabel(from, k + 1)}`,
      ride,
      from,
      to: k,
      label: spanLabel(from, k + 1),
      short: shortSpan(from, k + 1),
      hours: part.length,
      maxWind: Math.max(...part.map((p) => p.wind)),
      maxRain: Math.max(...part.map((p) => p.rain)),
      minTemp: Math.min(...part.map((p) => p.temp)),
      maxTemp: Math.max(...part.map((p) => p.temp)),
    })
    from = k + 1
  })
  return runs
}

/** The longest ride run; the earlier one wins a tie. */
export function bestRun(runs: readonly Run[]): Run | null {
  let best: Run | null = null
  for (const r of runs) if (r.ride && (best === null || r.hours > best.hours)) best = r
  return best
}
