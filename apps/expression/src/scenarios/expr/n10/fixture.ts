/** Seeded wind forecast for scenario expr-n10: four models, hourly, 72 h, plus an ensemble 10-90 band. */

export const MODELS = [
  { key: 'ecmwf', label: 'ECMWF' },
  { key: 'gfs', label: 'GFS' },
  { key: 'icon', label: 'ICON' },
  { key: 'arome', label: 'AROME' },
] as const

export type ModelKey = (typeof MODELS)[number]['key']
type PerModel = Record<ModelKey, number>

export type Hour = {
  t: Date
  speed: PerModel
  gust: PerModel
  /** Degrees the wind blows from. */
  dir: PerModel
  /** Ensemble 10th and 90th percentile of the wind speed. */
  p10: number
  p90: number
  /** Fastest model minus slowest model. */
  spread: number
}

export type FixtureName = 'default' | 'calm' | 'storm'

export type Forecast = {
  start: Date
  hours: readonly Hour[]
  /** The run of hours where the models are at least `PART_KT` apart, around the widest gap. */
  parting: { from: Date; to: Date } | null
  widest: Hour
  peakGust: { value: number; model: ModelKey; at: Date }
}

/** Models closer than this agree; at or past it they part. */
export const PART_KT = 4
const HOURS = 72
const START = Date.UTC(2026, 10, 17, 6)

type Shape = {
  /** Mean wind and the size of its daily swell, kt. */
  level: number
  swell: number
  /** Strength of the front every model brings, kt, and how far each model places it from the others. */
  front: number
  noise: number
  /** Ensemble half-width at hour 0 and its growth per hour. */
  band: [number, number]
  /** Hours a model reads exactly 0. */
  zero: Partial<Record<ModelKey, readonly [number, number]>>
}

const SHAPES: Record<FixtureName, Shape> = {
  default: { level: 10, swell: 3, front: 16, noise: 0.7, band: [1, 0.07], zero: { icon: [2, 5] } },
  calm: {
    level: 0.7,
    swell: 0.3,
    front: 0,
    noise: 0.25,
    band: [0.2, 0.004],
    zero: { gfs: [0, 3] },
  },
  storm: { level: 24, swell: 4, front: 32, noise: 1.6, band: [2, 0.12], zero: {} },
}

/** The hour each model places the front at, and how hard it hits there. */
const FRONT: Record<ModelKey, { at: number; power: number; veer: number }> = {
  ecmwf: { at: 44, power: 1, veer: 0 },
  gfs: { at: 50, power: 0.85, veer: 8 },
  icon: { at: 40, power: 1.15, veer: -6 },
  arome: { at: 54, power: 0.7, veer: 14 },
}

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const bump = (x: number): number => Math.exp(-((x / 7) ** 2))
const round1 = (v: number): number => Math.round(v * 10) / 10

export function buildForecast(name: FixtureName): Forecast {
  const shape = SHAPES[name]
  const rand = mulberry32(1117)
  const phase = Object.fromEntries(MODELS.map((m) => [m.key, rand() * 6])) as PerModel
  const gustRatio = Object.fromEntries(MODELS.map((m) => [m.key, 1.3 + rand() * 0.25])) as PerModel

  const hours: Hour[] = Array.from({ length: HOURS }, (_, h) => {
    const speed = {} as PerModel
    const gust = {} as PerModel
    const dir = {} as PerModel
    for (const { key } of MODELS) {
      const f = FRONT[key]
      const ramp = 0.4 + 0.6 * Math.min(1, h / 12)
      const swell = shape.level * ramp + shape.swell * Math.sin(h / 10 + 1)
      const noise = shape.noise * Math.sin(h * 0.7 + phase[key])
      const zero = shape.zero[key]
      const calmed = zero !== undefined && h >= zero[0] && h < zero[1]
      const v = calmed ? 0 : Math.max(0, swell + shape.front * f.power * bump(h - f.at) + noise)
      speed[key] = round1(v)
      gust[key] = round1(v * (gustRatio[key] + 0.1 * Math.abs(Math.sin(h / 3 + phase[key]))))
      const veer = 70 / (1 + Math.exp(-(h - f.at) / 3))
      dir[key] = Math.round(
        (((200 + f.veer + veer + 5 * Math.sin(h / 5 + phase[key])) % 360) + 360) % 360,
      )
    }
    const values = MODELS.map((m) => speed[m.key])
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const width = shape.band[0] + shape.band[1] * h + 0.08 * shape.front * bump(h - 47)
    return {
      t: new Date(START + h * 3_600_000),
      speed,
      gust,
      dir,
      p10: round1(Math.max(0, mean - width * 1.2)),
      p90: round1(mean + width * 1.2),
      spread: round1(Math.max(...values) - Math.min(...values)),
    }
  })

  let widestAt = 0
  hours.forEach((hour, i) => {
    if ((hours[widestAt]?.spread ?? 0) < hour.spread) widestAt = i
  })
  const widest = hours[widestAt] as Hour

  let parting: Forecast['parting'] = null
  if (widest.spread >= PART_KT) {
    let from = widestAt
    let to = widestAt
    while (from > 0 && (hours[from - 1]?.spread ?? 0) >= PART_KT) from -= 1
    while (to < hours.length - 1 && (hours[to + 1]?.spread ?? 0) >= PART_KT) to += 1
    parting = { from: (hours[from] as Hour).t, to: (hours[to] as Hour).t }
  }

  let peak: Forecast['peakGust'] = { value: -1, model: 'ecmwf', at: widest.t }
  for (const hour of hours) {
    for (const { key } of MODELS) {
      if (hour.gust[key] > peak.value) peak = { value: hour.gust[key], model: key, at: hour.t }
    }
  }
  return { hours, start: new Date(START), parting, widest, peakGust: peak }
}

const COMPASS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
]
export const compass = (deg: number): string => COMPASS[Math.round(deg / 22.5) % 16] ?? 'N'
