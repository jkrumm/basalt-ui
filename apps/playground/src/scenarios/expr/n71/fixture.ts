/**
 * A season's photo library, seeded and deterministic: about 6,000 photos, each with a body, a lens, a
 * rating (rejected to 5 stars, or unrated) and a size in bytes. Kept is 4 stars or more over judged
 * (every rated photo); an unrated photo is not judged. Counts per rating are fixed per variant and
 * the ratings are dealt to the photos by a per-body and per-lens quality, so the gear tables vary.
 */

export type RatingKey = 'rejected' | 'one' | 'two' | 'three' | 'four' | 'five' | 'unrated'
const RATING_KEYS: readonly RatingKey[] = [
  'rejected',
  'one',
  'two',
  'three',
  'four',
  'five',
  'unrated',
]

export type FixtureName = 'season' | 'reached' | 'few'

export type RatingRow = { key: RatingKey; photos: number; kept: boolean; judged: boolean }
export type GearRow = {
  key: string
  name: string
  photos: number
  judged: number
  kept: number
  /** The keys of the lenses this body shot, or the bodies this lens sat on. */
  with: readonly string[]
}
export type StorageRow = { key: 'staging' | 'final' | 'trash'; bytes: number }

export type Library = {
  photos: number
  judged: number
  kept: number
  unrated: number
  ratings: readonly RatingRow[]
  bodies: readonly GearRow[]
  lenses: readonly GearRow[]
  storage: readonly StorageRow[]
}

/** The keeper rate needs this many judged photos, and the target is a share of them. */
export const MIN_JUDGED = 20
export const TARGET_PERCENT = 35

const COUNTS: Record<FixtureName, Record<RatingKey, number>> = {
  season: { rejected: 700, one: 320, two: 780, three: 1740, four: 1100, five: 460, unrated: 900 },
  reached: { rejected: 650, one: 300, two: 700, three: 1650, four: 1340, five: 460, unrated: 900 },
  few: { rejected: 2, one: 1, two: 3, three: 5, four: 5, five: 2, unrated: 5982 },
}

const TOTAL = 6000
const SINGLE_LENS = 'Tilt-shift 17'

type BodySpec = {
  name: string
  weight: number
  bias: number
  megabytes: number
  lenses: readonly (readonly [string, number, number])[]
}

// [lens, weight on this body, quality bias]
const BODIES: readonly BodySpec[] = [
  {
    name: 'A7 IV',
    weight: 17,
    bias: 0.1,
    megabytes: 33,
    lenses: [
      ['24-70 f/2.8', 5, 0],
      ['35 f/1.4', 4, 0.3],
      ['85 f/1.4', 3, 0.4],
      ['16-35 f/4', 2, -0.1],
    ],
  },
  {
    name: 'A7R V',
    weight: 9,
    bias: 0.3,
    megabytes: 62,
    lenses: [
      ['24-70 f/2.8', 3, 0],
      ['85 f/1.4', 4, 0.4],
      ['35 f/1.4', 3, 0.3],
    ],
  },
  {
    name: 'Z8',
    weight: 12,
    bias: 0.2,
    megabytes: 48,
    lenses: [
      ['70-200 f/2.8', 6, 0.1],
      ['100-400 f/5.6', 4, -0.3],
      ['24-70 f/2.8', 3, 0],
    ],
  },
  {
    name: 'Z6 II',
    weight: 8,
    bias: -0.3,
    megabytes: 28,
    lenses: [
      ['24-70 f/2.8', 4, 0],
      ['50 f/1.2', 3, 0.3],
      ['Tilt-shift 17', 0, 0],
    ],
  },
  {
    name: 'R5',
    weight: 14,
    bias: 0,
    megabytes: 44,
    lenses: [
      ['70-200 f/2.8', 5, 0.1],
      ['135 f/1.8', 3, 0.4],
      ['24 f/1.4', 3, 0.1],
    ],
  },
  {
    name: 'R6 II',
    weight: 10,
    bias: -0.2,
    megabytes: 30,
    lenses: [
      ['100-400 f/5.6', 5, -0.3],
      ['70-200 f/2.8', 3, 0.1],
      ['24 f/1.4', 1, 0.1],
    ],
  },
  {
    name: 'X-T5',
    weight: 11,
    bias: -0.1,
    megabytes: 40,
    lenses: [
      ['35 f/1.4', 5, 0.3],
      ['50 f/1.2', 2, 0.3],
      ['16-35 f/4', 3, -0.1],
    ],
  },
  {
    name: 'X-H2',
    weight: 7,
    bias: -0.4,
    megabytes: 40,
    lenses: [
      ['24-70 f/2.8', 3, 0],
      ['16-35 f/4', 3, -0.1],
      ['50 f/1.2', 1, 0.3],
    ],
  },
  {
    name: 'GFX 100S',
    weight: 5,
    bias: 0.4,
    megabytes: 105,
    lenses: [
      ['85 f/1.4', 3, 0.4],
      ['24 f/1.4', 2, 0.1],
    ],
  },
  {
    name: 'OM-1',
    weight: 7,
    bias: -0.5,
    megabytes: 24,
    lenses: [
      ['100-400 f/5.6', 4, -0.3],
      ['135 f/1.8', 1, 0.4],
      ['16-35 f/4', 2, -0.1],
    ],
  },
]

function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, rows: readonly T[], weight: (row: T) => number): T {
  const total = rows.reduce((sum, row) => sum + weight(row), 0)
  let at = rng() * total
  for (const row of rows) {
    at -= weight(row)
    if (at < 0) return row
  }
  return rows[rows.length - 1] as T
}

type Photo = {
  body: number
  lens: string
  quality: number
  rating: RatingKey
  bytes: number
}

const cache = new Map<FixtureName, Library>()

export function libraryOf(name: FixtureName): Library {
  const hit = cache.get(name)
  if (hit !== undefined) return hit
  const library = build(name)
  cache.set(name, library)
  return library
}

function build(name: FixtureName): Library {
  const rng = seeded(711)
  const counts = COUNTS[name]
  const singleAt = 3141
  const photos: Photo[] = []
  for (let i = 0; i < TOTAL; i += 1) {
    const body = i === singleAt ? 3 : BODIES.indexOf(pick(rng, BODIES, (b) => b.weight))
    const spec = BODIES[body] as BodySpec
    const lens = i === singleAt ? SINGLE_LENS : pick(rng, spec.lenses, ([, weight]) => weight)[0]
    const lensBias = spec.lenses.find(([key]) => key === lens)?.[2] ?? 0
    const noise = rng() + rng() + rng() - 1.5
    const quality = i === singleAt ? Infinity : (spec.bias + lensBias) * 0.4 + noise
    const bytes = Math.round(spec.megabytes * (0.7 + rng() * 0.6) * 1_000_000)
    photos.push({ body, lens, quality, rating: 'unrated', bytes })
  }

  // The unrated are a seeded shuffle of everything but the single-lens photo.
  const ids = photos.map((_, i) => i).filter((i) => i !== singleAt)
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = ids[i] as number
    ids[i] = ids[j] as number
    ids[j] = tmp
  }
  const judgedIds = new Set<number>([singleAt, ...ids.slice(counts.unrated)])
  const judged = [...judgedIds].sort(
    (a, b) => (photos[b] as Photo).quality - (photos[a] as Photo).quality,
  )
  const order: readonly RatingKey[] = ['five', 'four', 'three', 'two', 'one', 'rejected']
  let at = 0
  for (const key of order) {
    for (let n = 0; n < counts[key]; n += 1) {
      const id = judged[at]
      at += 1
      if (id !== undefined) (photos[id] as Photo).rating = key
    }
  }

  const isKept = (p: Photo): boolean => p.rating === 'four' || p.rating === 'five'
  const isJudged = (p: Photo): boolean => p.rating !== 'unrated'
  const ratings: RatingRow[] = RATING_KEYS.map((key) => ({
    key,
    photos: photos.filter((p) => p.rating === key).length,
    kept: key === 'four' || key === 'five',
    judged: key !== 'unrated',
  }))

  const bodyRows = new Map<string, GearRow & { with: string[] }>()
  const lensRows = new Map<string, GearRow & { with: string[] }>()
  const bump = (
    rows: Map<string, GearRow & { with: string[] }>,
    key: string,
    other: string,
    p: Photo,
  ): void => {
    const row = rows.get(key) ?? { key, name: key, photos: 0, judged: 0, kept: 0, with: [] }
    row.photos += 1
    if (isJudged(p)) row.judged += 1
    if (isKept(p)) row.kept += 1
    if (!row.with.includes(other)) row.with.push(other)
    rows.set(key, row)
  }
  for (const p of photos) {
    const body = (BODIES[p.body] as BodySpec).name
    bump(bodyRows, body, p.lens, p)
    bump(lensRows, p.lens, body, p)
  }
  const byPhotos = (a: GearRow, b: GearRow): number =>
    b.photos - a.photos || a.name.localeCompare(b.name)

  let staging = 0
  let final = 0
  for (const p of photos) {
    if (isKept(p)) final += p.bytes
    else staging += p.bytes
  }

  return {
    photos: photos.length,
    judged: photos.filter(isJudged).length,
    kept: photos.filter(isKept).length,
    unrated: photos.filter((p) => !isJudged(p)).length,
    ratings,
    bodies: [...bodyRows.values()].sort(byPhotos),
    lenses: [...lensRows.values()].sort(byPhotos),
    storage: [
      { key: 'staging', bytes: staging },
      { key: 'final', bytes: final },
      { key: 'trash', bytes: 0 },
    ],
  }
}
