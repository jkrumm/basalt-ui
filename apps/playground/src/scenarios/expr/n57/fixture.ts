/**
 * Ten nights at four sites: half-hourly cloud cover in three layers, the moon, the astronomical
 * darkness and the sites' drive time and sky brightness. Seeded, so the same names give the same
 * numbers. Hours are hours since noon, so 24.5 is 00:30 on the next morning.
 */
import type { CalendarDate } from 'basalt-ui'

export type SiteId = 'heide' | 'moor' | 'kamm' | 'salz'
export type Site = { id: SiteId; name: string; drive: number; sky: number }

/** Nearest first. Drive in minutes, sky in mag/arcsec². */
export const SITES: readonly Site[] = [
  { id: 'heide', name: 'Heide', drive: 35, sky: 21.2 },
  { id: 'moor', name: 'Hochmoor', drive: 70, sky: 21.6 },
  { id: 'kamm', name: 'Kamm', drive: 110, sky: 21.8 },
  { id: 'salz', name: 'Salzsee', drive: 155, sky: 21.95 },
]

export type Night = {
  id: CalendarDate
  /** The lit share of the moon's disc, 0 to 1. */
  illum: number
  /** The hours the moon is up, from and to; null when it never rises in the night. */
  moonUp: readonly [number, number] | null
  darkFrom: number
  darkTo: number
}

export const NIGHTS: readonly Night[] = [
  { id: '2026-11-19', illum: 0.58, moonUp: [18, 24.5], darkFrom: 18.4, darkTo: 29.6 },
  { id: '2026-11-20', illum: 0.7, moonUp: [18, 25.5], darkFrom: 18.4, darkTo: 29.6 },
  { id: '2026-11-21', illum: 0.84, moonUp: [18, 27], darkFrom: 18.35, darkTo: 29.65 },
  { id: '2026-11-22', illum: 1, moonUp: [18, 31], darkFrom: 18.35, darkTo: 29.7 },
  { id: '2026-11-23', illum: 0.94, moonUp: [18.9, 31], darkFrom: 18.3, darkTo: 29.7 },
  { id: '2026-11-24', illum: 0.86, moonUp: [19.9, 31], darkFrom: 18.3, darkTo: 29.75 },
  { id: '2026-11-25', illum: 0.76, moonUp: [21, 31], darkFrom: 18.3, darkTo: 29.8 },
  { id: '2026-11-26', illum: 0.65, moonUp: [22.1, 31], darkFrom: 18.25, darkTo: 29.8 },
  { id: '2026-11-27', illum: 0.54, moonUp: [23.2, 31], darkFrom: 18.25, darkTo: 29.85 },
  { id: '2026-11-28', illum: 0.43, moonUp: [24.3, 31], darkFrom: 18.2, darkTo: 29.9 },
]

/** The clear spells of a night at a site, as hour spans; none is a night under cloud, `null` no forecast. */
type Spell = readonly [number, number]
type Weather = readonly Spell[] | null

const NONE: Weather = []
const WHOLE: Weather = [[18, 31]]

const REST_WEATHER: readonly (readonly Weather[])[] = [
  [NONE, [[22, 27]], [[20, 30]], [[23, 30]]],
  [[[19, 23]], [[24, 30]], [[25, 30]], [[19, 24]]],
  [NONE, NONE, [[26, 30]], [[22, 28]]],
  [WHOLE, WHOLE, WHOLE, WHOLE],
  [NONE, NONE, [[22, 25]], NONE],
  [[[20, 24]], [[21, 26]], null, [[20, 27]]],
  [NONE, [[22, 25]], null, [[21, 26.5]]],
  [[[19, 24]], [[20, 30]], [[19, 30]], [[18, 27]]],
  [[[26, 30]], [[24, 30]], WHOLE, WHOLE],
  [NONE, [[21, 30]], [[18, 30]], [[22, 30]]],
]

/** Every name `?fixture=` takes: the rest nights, a cloud-covered run and a clear one. */
const FIXTURES = ['overcast', 'clear'] as const
export type FixtureName = (typeof FIXTURES)[number]

function weatherFor(fixture: string | undefined): readonly (readonly Weather[])[] {
  if (fixture === 'overcast') return NIGHTS.map(() => SITES.map(() => NONE))
  if (fixture === 'clear') return NIGHTS.map(() => SITES.map(() => WHOLE))
  return REST_WEATHER
}

export type Slot = {
  /** Hours since noon. */
  at: number
  low: number
  mid: number
  high: number
  /** The sky the three layers leave covered, in %. */
  total: number
  moonUp: boolean
}

export type Forecast = { night: Night; site: Site; slots: readonly Slot[] }

function rng(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const smooth = (edge0: number, edge1: number, x: number): number => {
  const u = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return u * u * (3 - 2 * u)
}

function slotsOf(night: Night, site: Site, nightIndex: number, weather: Weather): Slot[] {
  if (weather === null) return []
  const siteIndex = SITES.indexOf(site)
  const random = rng(5700 + nightIndex * 31 + siteIndex * 7)
  const cloudy = 82 + random() * 14
  const clear = 3 + random() * 9
  const lowShare = 0.25 + random() * 0.35
  const midShare = (1 - lowShare) * (0.3 + random() * 0.4)
  const shares = [lowShare, midShare, 1 - lowShare - midShare] as const
  const first = Math.ceil(night.darkFrom * 2) / 2
  const last = Math.floor(night.darkTo * 2) / 2
  const slots: Slot[] = []
  for (let at = first; at <= last; at += 0.5) {
    const clearness = weather.reduce(
      (best, [from, to]) =>
        Math.max(
          best,
          smooth(from - 0.75, from + 0.75, at) * (1 - smooth(to - 0.75, to + 0.75, at)),
        ),
      0,
    )
    const target = Math.min(
      99,
      Math.max(0, cloudy + (clear - cloudy) * clearness + (random() - 0.5) * 8),
    )
    const layer = (share: number): number => Math.round(100 * (1 - (1 - target / 100) ** share))
    const [low, mid, high] = [layer(shares[0]), layer(shares[1]), layer(shares[2])] as const
    const total = Math.round(
      100 * (1 - ((100 - low) / 100) * ((100 - mid) / 100) * ((100 - high) / 100)),
    )
    const moonUp = night.moonUp !== null && at >= night.moonUp[0] && at < night.moonUp[1]
    slots.push({ at, low, mid, high, total, moonUp })
  }
  return slots
}

/** One forecast per night and site, nights in time order and sites nearest first. */
export function forecastsFor(fixture: string | undefined): Forecast[] {
  const weather = weatherFor(fixture)
  return NIGHTS.flatMap((night, i) =>
    SITES.map((site, s) => {
      const spells = weather[i]?.[s]
      return { night, site, slots: slotsOf(night, site, i, spells === undefined ? NONE : spells) }
    }),
  )
}
