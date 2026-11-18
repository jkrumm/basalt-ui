/**
 * The Kit gallery's one dataset: a photo library, the shape a media app such as a photo manager lists, filters,
 * peeks and inspects. Deterministic, so a shot is the same shot. Ids are numeric strings so `/kit/photos/12` is a
 * record the quality matrix can open.
 */
export const COLLECTIONS = ['alps', 'coast', 'city', 'studio'] as const
export type Collection = (typeof COLLECTIONS)[number]

export const COLLECTION_LABELS: Record<Collection, string> = {
  alps: 'Alps',
  coast: 'Coast',
  city: 'City',
  studio: 'Studio',
}

export const VERDICTS = ['picked', 'unrated', 'rejected'] as const
export type Verdict = (typeof VERDICTS)[number]

export const VERDICT_LABELS: Record<Verdict, string> = {
  picked: 'Picked',
  unrated: 'Unrated',
  rejected: 'Rejected',
}

export const VERDICT_TONE: Record<Verdict, 'good' | 'neutral' | 'bad'> = {
  picked: 'good',
  unrated: 'neutral',
  rejected: 'bad',
}

export type Photo = {
  id: string
  title: string
  collection: Collection
  verdict: Verdict
  camera: string
  lens: string
  iso: number
  aperture: string
  shutter: string
  /** The day it was taken, `YYYY-MM-DD`. */
  taken: string
  sizeMb: number
  views: number
  /** Views per day over the last 14 days, oldest first. */
  perDay: readonly number[]
}

const PLACES: Record<Collection, readonly string[]> = {
  alps: [
    'Ridge at dawn',
    'Glacier tongue',
    'Hut in fog',
    'Pass road',
    'Summit cross',
    'Larch slope',
  ],
  coast: ['Low tide', 'Harbour wall', 'Dune grass', 'Lighthouse', 'Breakwater', 'Salt flats'],
  city: ['Tram stop', 'Rooftops', 'Night market', 'Stairwell', 'Bridge cables', 'Rain window'],
  studio: [
    'Hands study',
    'Still life',
    'Portrait, grey',
    'Backlit glass',
    'Paper folds',
    'Profile',
  ],
}

const CAMERAS = ['X-T5', 'Z 8', 'A7 IV', 'Q3'] as const
const LENSES = [
  '23 mm f/2',
  '35 mm f/1.4',
  '56 mm f/1.2',
  '16-55 mm f/2.8',
  '70-200 mm f/4',
] as const
const APERTURES = ['f/1.4', 'f/2', 'f/2.8', 'f/4', 'f/8', 'f/11'] as const
const SHUTTERS = ['1/30', '1/125', '1/250', '1/500', '1/1000', '2 s'] as const

const pick = <T>(list: readonly T[], n: number): T => list[n % list.length] as T

const dayOf = (n: number): string =>
  new Date(Date.UTC(2026, 10, 14 - ((n * 3) % 90))).toISOString().slice(0, 10)

/** 48 photos, twelve per collection. */
export const PHOTOS: readonly Photo[] = Array.from({ length: 48 }, (_, i) => {
  const collection = pick(COLLECTIONS, i)
  const perDay = Array.from(
    { length: 14 },
    (_, d) => 4 + ((i * 7 + d * 5) % 23) + Math.round(Math.sin((i + d) / 3) * 3),
  )
  return {
    id: String(i + 1),
    title: `${pick(PLACES[collection], Math.floor(i / 4))} ${Math.floor(i / 24) + 1}`,
    collection,
    verdict: pick(VERDICTS, (i * 5) % 7),
    camera: pick(CAMERAS, i * 3),
    lens: pick(LENSES, i * 7),
    iso: pick([100, 200, 400, 800, 1600, 3200], i * 5),
    aperture: pick(APERTURES, i * 11),
    shutter: pick(SHUTTERS, i * 13),
    taken: dayOf(i),
    sizeMb: Math.round((18 + ((i * 37) % 44)) * 10) / 10,
    views: perDay.reduce((sum, v) => sum + v, 0),
    perDay,
  }
})

export const photoOf = (id: string): Photo | undefined => PHOTOS.find((photo) => photo.id === id)
