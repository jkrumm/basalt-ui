/**
 * Seeded forecast fixture: five days of hourly air temperature and dew point from three models.
 * One model (GFS) runs about 3 °C warmer than the other two. Variants: the default spell has a marginal
 * frost, a hard frost and a night where one model dips alone; `clear` has no frost on any night (zero hours);
 * `hard` is a long deep freeze (extreme values).
 */

export const MODELS = ['ecmwf', 'gfs', 'icon'] as const
export type ModelKey = (typeof MODELS)[number]
export const MODEL_NAME: Record<ModelKey, string> = { ecmwf: 'ECMWF', gfs: 'GFS', icon: 'ICON' }

export type Reading = {
  at: Date
  /** Air temperature per model, °C. */
  temp: Record<ModelKey, number>
  /** Dew point per model, °C. */
  dew: Record<ModelKey, number>
}

export type FixtureName = 'rest' | 'clear' | 'hard'

const HOUR = 3_600_000
/** Tue 17 Nov 2026, 12:00 UTC: the first hour of the forecast. */
const START = Date.UTC(2026, 10, 17, 12)
const HOURS = 120
/** Hours after START of each daily maximum (15:00) and of each night's minimum (05:00). */
const MAX_AT = (day: number): number => 3 + 24 * day
const MIN_AT = (night: number): number => 17 + 24 * night

type Spell = {
  /** Daily maxima, Tue to Sun. */
  maxima: readonly number[]
  /** Night minima, the five nights Tue to Sat. */
  minima: readonly number[]
  /** Share of cloud per night, 0 to 1: a cloudy night keeps the dew point close to the air. */
  cloud: readonly number[]
}

const SPELLS: Record<FixtureName, Spell> = {
  rest: {
    maxima: [7.4, 6, 4.2, 3, 7, 8.2],
    minima: [2.1, -1.2, -5, 0.3, 4.6],
    cloud: [0.7, 0.2, 0, 0.3, 0.9],
  },
  clear: {
    maxima: [9, 8.5, 7, 7.5, 9, 10],
    minima: [4.6, 3.9, 2.8, 3.6, 5.2],
    cloud: [0.8, 0.6, 0.5, 0.7, 0.9],
  },
  hard: {
    maxima: [1.5, 0.2, -1, -2, 0.5, 2.5],
    minima: [-4.5, -7.5, -11.5, -9, -3.5],
    cloud: [0.1, 0, 0, 0.1, 0.4],
  },
}

/** Each model's offset from the shared curve, °C: GFS is the warm one. */
const OFFSET: Record<ModelKey, number> = { ecmwf: -0.5, gfs: 3, icon: 0.3 }

/** A small seeded generator (mulberry32), so every build draws the same forecast. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** The shared air temperature at hour `h`: a cosine from each extreme to the next. */
function curve(spell: Spell, h: number): number {
  const extremes: { at: number; value: number }[] = []
  spell.maxima.forEach((value, day) => extremes.push({ at: MAX_AT(day), value }))
  spell.minima.forEach((value, night) => extremes.push({ at: MIN_AT(night), value }))
  extremes.sort((x, y) => x.at - y.at)
  const first = extremes[0]
  const last = extremes.at(-1)
  if (first === undefined || last === undefined) return 0
  if (h <= first.at) return first.value
  if (h >= last.at) return last.value
  const next = extremes.findIndex((e) => e.at >= h)
  const from = extremes[next - 1]
  const to = extremes[next]
  if (from === undefined || to === undefined) return last.value
  const u = (h - from.at) / (to.at - from.at)
  return from.value + ((to.value - from.value) * (1 - Math.cos(Math.PI * u))) / 2
}

const round1 = (v: number): number => Math.round(v * 10) / 10

export function forecastFor(name: string | undefined): readonly Reading[] {
  const key: FixtureName = name === 'clear' || name === 'hard' ? name : 'rest'
  const spell = SPELLS[key]
  const rand = seeded(39)
  return Array.from({ length: HOURS }, (_, h) => {
    const at = new Date(START + h * HOUR)
    const shared = curve(spell, h)
    const hourOfDay = at.getUTCHours()
    const sunny = (1 + Math.cos((2 * Math.PI * (hourOfDay - 15)) / 24)) / 2
    const night = Math.min(4, Math.max(0, Math.round((h - 17) / 24)))
    const clear = 1 - (spell.cloud[night] ?? 0)
    const read = (m: ModelKey, i: number) => {
      const wobble = 0.3 * Math.sin((2 * Math.PI * h) / (29 + 7 * i) + i) + (rand() - 0.5) * 0.3
      const temp = round1(shared + OFFSET[m] + wobble)
      const depression = 0.5 + (0.6 + 2.4 * sunny) * clear + (rand() - 0.5) * 0.4
      return { temp, dew: round1(temp - Math.max(0.2, depression)) }
    }
    const ecmwf = read('ecmwf', 0)
    const gfs = read('gfs', 1)
    const icon = read('icon', 2)
    const temp = { ecmwf: ecmwf.temp, gfs: gfs.temp, icon: icon.temp }
    const dew = { ecmwf: ecmwf.dew, gfs: gfs.dew, icon: icon.dew }
    return { at, temp, dew }
  })
}
