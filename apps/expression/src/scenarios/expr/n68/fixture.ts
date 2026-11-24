/** The site's core-hours fixture: seeded and deterministic, one shape for every named variant. */

export const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

/** Usable core hours of one month in a cloud-free year, once over a flat horizon and once behind the terrain. */
export type MonthHours = { month: string; flat: number; behind: number; cost: number }

/** The ridge along the core's arc at one azimuth, in degrees above a flat horizon. */
export type Bearing = { az: number; highest: number; mean: number }

export type Site = {
  months: readonly MonthHours[]
  ridge: readonly Bearing[]
  /** The site's light-pollution class on the Bortle scale. */
  bortle: number
}

function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Model = {
  seed: number
  /** Hours over a flat horizon, per month. */
  flat: readonly number[]
  /** The share of those hours that clears the ridge, per month; 0 is a month the core never clears it. */
  kept: readonly number[]
  /** The ridge: its bumps as [azimuth, width, height] over a base height. */
  bumps: readonly (readonly [number, number, number])[]
  base: number
  bortle: number
}

const DEFAULT: Model = {
  seed: 68,
  flat: [0, 9, 41, 84, 121, 131, 124, 98, 53, 11, 0, 0],
  kept: [0, 0, 0.34, 0.56, 0.65, 0.66, 0.65, 0.54, 0.36, 0, 0, 0],
  bumps: [
    [120, 10, 9],
    [165, 16, 17],
    [195, 11, 12],
    [235, 14, 8],
  ],
  base: 4,
  bortle: 4,
}

const MODELS: Record<string, Model> = {
  /** A ridge that walls the whole arc: no month clears it. */
  'walled-in': {
    ...DEFAULT,
    kept: DEFAULT.kept.map(() => 0),
    bumps: [
      [140, 30, 30],
      [190, 30, 24],
      [230, 30, 28],
    ],
    base: 24,
  },
  /** A southern site: the core stands high, hours run far past the default's, the ridge is low. */
  southern: {
    seed: 7,
    flat: [34, 14, 40, 104, 184, 238, 222, 160, 88, 34, 6, 18],
    kept: [0.88, 0.5, 0.9, 0.94, 0.95, 0.95, 0.95, 0.93, 0.9, 0.88, 0.8, 0.86],
    bumps: [
      [150, 18, 3],
      [210, 14, 3],
    ],
    base: 2,
    bortle: 2,
  },
}

const round1 = (n: number): number => Math.round(n * 10) / 10

export function siteFor(fixture: string | undefined): Site {
  const model = (fixture === undefined ? undefined : MODELS[fixture]) ?? DEFAULT
  const next = rng(model.seed)
  const months = MONTH_NAMES.map((month, i) => {
    const base = model.flat[i] ?? 0
    const flat = base === 0 ? 0 : Math.max(1, base + Math.round((next() - 0.5) * 6))
    const behind = Math.round(flat * (model.kept[i] ?? 0))
    return { month, flat, behind, cost: flat - behind }
  })
  const ridge: Bearing[] = []
  for (let az = 105; az <= 255; az += 5) {
    const bumps = model.bumps.reduce(
      (sum, [at, width, height]) => sum + height * Math.exp(-(((az - at) / width) ** 2)),
      0,
    )
    const highest = round1(Math.max(1, model.base + bumps + next() * 0.8))
    ridge.push({ az, highest, mean: round1(Math.max(0.5, highest * (0.5 + next() * 0.06))) })
  }
  return { months, ridge, bortle: model.bortle }
}
