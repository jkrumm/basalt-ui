/** Seeded photo-library fixture for scenario expr-n96: the same 5,024 photos counted four ways. */

export type Setting = { label: string; photos: number }

export type Library = {
  total: number
  focal: readonly Setting[]
  aperture: readonly Setting[]
  iso: readonly Setting[]
  shutter: readonly Setting[]
}

export type Variant = 'default' | 'no-iso'

const TOTAL = 5024

/** label, weight (0 keeps an empty bucket), fixed count that skips the allocation. */
type Spec = readonly [label: string, weight: number, fixed?: number]

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Splits TOTAL over the weighted buckets with seeded jitter; the largest remainders take the rounding, so every dimension sums to TOTAL. */
function allocate(specs: readonly Spec[], seed: number): Setting[] {
  const rand = mulberry32(seed)
  const pool = TOTAL - specs.reduce((sum, [, , fixed]) => sum + (fixed ?? 0), 0)
  const raw = specs.map(([, weight, fixed]) =>
    fixed !== undefined || weight === 0 ? 0 : weight * (0.88 + 0.24 * rand()),
  )
  const rawSum = raw.reduce((sum, r) => sum + r, 0)
  const exact = raw.map((r) => (r / rawSum) * pool)
  const counts = exact.map(Math.floor)
  const spare = pool - counts.reduce((sum, c) => sum + c, 0)
  exact
    .map((e, i) => ({ i, rest: e - Math.floor(e) }))
    .filter(({ i }) => raw[i] !== 0)
    .sort((a, b) => b.rest - a.rest)
    .slice(0, spare)
    .forEach(({ i }) => {
      counts[i] = (counts[i] ?? 0) + 1
    })
  return specs.map(([label, , fixed], i) => ({ label, photos: fixed ?? counts[i] ?? 0 }))
}

const FOCAL: readonly Spec[] = [
  ['10', 6],
  ['12', 0],
  ['14', 25],
  ['16', 70],
  ['18', 55],
  ['20', 60],
  ['24', 520],
  ['28', 300],
  ['35', 900],
  ['40', 80],
  ['50', 700],
  ['70', 140],
  ['85', 390],
  ['100', 70],
  ['135', 190],
  ['200', 330],
  ['300', 0],
  ['400', 90],
  ['500', 12],
  ['600', 0, 1],
]

/** F-numbers to one decimal, a third of a stop apart. */
const APERTURE: readonly Spec[] = [
  ['1.2', 5],
  ['1.4', 180],
  ['1.6', 90],
  ['1.8', 260],
  ['2', 240],
  ['2.2', 70],
  ['2.5', 110],
  ['2.8', 780],
  ['3.2', 150],
  ['3.5', 210],
  ['4', 520],
  ['4.5', 140],
  ['5', 160],
  ['5.6', 440],
  ['6.3', 90],
  ['7.1', 120],
  ['8', 360],
  ['9', 60],
  ['10', 40],
  ['11', 150],
  ['13', 30],
  ['14', 0],
  ['16', 45],
  ['18', 0],
  ['22', 12],
]

/** A sparse list: only the ISO values the library holds, the highest on 2 photos. */
const ISO: readonly Spec[] = [
  ['100', 610],
  ['160', 25],
  ['200', 700],
  ['320', 60],
  ['400', 930],
  ['640', 80],
  ['800', 760],
  ['1250', 30],
  ['1600', 640],
  ['2500', 20],
  ['3200', 520],
  ['6400', 300],
  ['12800', 70],
  ['25600', 12],
  ['102400', 0, 2],
]

const SHUTTER: readonly Spec[] = [
  ['1/8000', 15],
  ['1/4000', 60],
  ['1/3200', 40],
  ['1/2000', 290],
  ['1/1600', 150],
  ['1/1000', 520],
  ['1/800', 260],
  ['1/500', 700],
  ['1/400', 300],
  ['1/250', 880],
  ['1/200', 260],
  ['1/125', 640],
  ['1/100', 150],
  ['1/60', 310],
  ['1/30', 220],
  ['1/15', 70],
  ['1/8', 40],
  ['1/4', 25],
  ['1/2', 10],
  ['1', 6],
  ['2', 0],
  ['4', 0],
  ['8', 8],
  ['15', 3],
  ['30', 5],
]

/** `fixture` is the raw `?fixture=` value: `no-iso` is a library whose photos carry no ISO. */
export function variantOf(fixture: string | undefined): Variant {
  return fixture === 'no-iso' ? 'no-iso' : 'default'
}

export function buildLibrary(variant: Variant): Library {
  return {
    total: TOTAL,
    focal: allocate(FOCAL, 96_01),
    aperture: allocate(APERTURE, 96_02),
    iso: variant === 'no-iso' ? [] : allocate(ISO, 96_03),
    shutter: allocate(SHUTTER, 96_04),
  }
}
