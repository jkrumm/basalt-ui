/**
 * Image library cost: about 400 generations across five models and two quality tiers, each with the
 * plan's estimate and a measured cost in US dollars. Seeded and deterministic; `?fixture=` picks a variant.
 */

export type Quality = 'standard' | 'hd'

/** How a model's estimates came about: the basis decides how far its miss can be trusted. */
export type Basis = 'measured' | 'placeholder' | 'extrapolated' | 'standard-rate'

export type Generation = {
  id: string
  model: string
  quality: Quality
  estimate: number
  /** `null` is an entry with no price on it. */
  measured: number | null
}

/** One model at one quality, over the entries that carry a measured cost. */
export type Cell = {
  entries: number
  priced: number
  estimate: number
  measured: number
  /** (measured - estimate) / estimate as a fraction; `null` where no entry is priced. */
  miss: number | null
}

export type ModelRow = {
  name: string
  basis: Basis
  entries: number
  standard: Cell
  hd: Cell
  /** The miss in whole percent, `null` where no entry is priced: what the table prints. */
  standardPct: number | null
  hdPct: number | null
  unpriced: number
  /** The estimate of the unpriced entries: what they would cost if the plan held. */
  hidden: number
}

export type Summary = {
  models: readonly ModelRow[]
  entries: number
  unpriced: number
  hidden: number
  /** Estimated spend of every entry, priced or not. */
  estimated: number
  /** The miss over every priced entry. */
  overall: number | null
  widest: { name: string; quality: Quality; miss: number; basis: Basis } | null
}

type ModelSpec = {
  name: string
  basis: Basis
  standard: { count: number; rate: number; bias: number; unpriced: number }
  hd: { count: number; rate: number; bias: number; unpriced: number }
}

/** Rates are the plan's per-image estimate; bias is how far the measured cost sits from it. */
const MODELS: readonly ModelSpec[] = [
  {
    name: 'Atlas',
    basis: 'measured',
    standard: { count: 46, rate: 0.04, bias: 0, unpriced: 0 },
    hd: { count: 34, rate: 0.08, bias: 0.04, unpriced: 2 },
  },
  {
    // The plan priced HD at the Standard rate, so every HD estimate is about half the real cost.
    name: 'Lumen',
    basis: 'standard-rate',
    standard: { count: 44, rate: 0.05, bias: -0.06, unpriced: 4 },
    hd: { count: 30, rate: 0.05, bias: 1, unpriced: 7 },
  },
  {
    // A flat placeholder in the plan; nobody measured this model before it was planned.
    name: 'Quill',
    basis: 'placeholder',
    standard: { count: 40, rate: 0.03, bias: -0.38, unpriced: 0 },
    hd: { count: 26, rate: 0.03, bias: 0.47, unpriced: 0 },
  },
  {
    // Estimates extrapolated from another model's price list.
    name: 'Vesper',
    basis: 'extrapolated',
    standard: { count: 42, rate: 0.045, bias: 0.19, unpriced: 4 },
    hd: { count: 28, rate: 0.09, bias: 0.27, unpriced: 0 },
  },
  {
    name: 'Prism',
    basis: 'measured',
    standard: { count: 62, rate: 0.035, bias: -0.03, unpriced: 0 },
    hd: { count: 48, rate: 0.07, bias: 0.09, unpriced: 3 },
  },
]

const IMAGES = [1, 1, 1, 2, 4] as const

/** mulberry32: a small seeded generator, so every build draws the same library. */
function seeded(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const cents = (n: number): number => Math.round(n * 1000) / 1000

type Variant = 'rest' | 'exact' | 'extreme' | 'fresh'

function generate(variant: Variant): Generation[] {
  if (variant === 'fresh') return []
  const next = seeded(98)
  const out: Generation[] = []
  for (const spec of MODELS) {
    for (const quality of ['standard', 'hd'] as const) {
      const tier = spec[quality]
      const bias =
        variant === 'extreme' && spec.name === 'Prism' && quality === 'hd' ? 3.8 : tier.bias
      const unpricedAt = new Set<number>()
      const unpriced = variant === 'exact' ? 0 : tier.unpriced
      while (unpricedAt.size < unpriced) unpricedAt.add(Math.floor(next() * tier.count))
      for (let i = 0; i < tier.count; i++) {
        const estimate = cents(tier.rate * IMAGES[Math.floor(next() * IMAGES.length)]!)
        const noise = variant === 'exact' || bias === 0 ? 0 : (next() - 0.5) * 0.16
        const measured = variant === 'exact' ? estimate : cents(estimate * (1 + bias) * (1 + noise))
        out.push({
          id: `${spec.name}-${quality}-${i + 1}`,
          model: spec.name,
          quality,
          estimate,
          measured: unpricedAt.has(i) ? null : measured,
        })
      }
    }
  }
  return out
}

function cellOf(rows: readonly Generation[]): Cell {
  const priced = rows.filter((g) => g.measured !== null)
  const estimate = priced.reduce((sum, g) => sum + g.estimate, 0)
  const measured = priced.reduce((sum, g) => sum + (g.measured ?? 0), 0)
  return {
    entries: rows.length,
    priced: priced.length,
    estimate,
    measured,
    miss: priced.length === 0 ? null : (measured - estimate) / estimate,
  }
}

const percentOf = (miss: number | null): number | null =>
  miss === null ? null : Math.round(miss * 100)

const reach = (m: ModelRow): number =>
  Math.max(Math.abs(m.standard.miss ?? 0), Math.abs(m.hd.miss ?? 0))

function summarize(library: readonly Generation[]): Summary {
  const rows = MODELS.flatMap((spec): ModelRow[] => {
    const own = library.filter((g) => g.model === spec.name)
    if (own.length === 0) return []
    const open = own.filter((g) => g.measured === null)
    const standard = cellOf(own.filter((g) => g.quality === 'standard'))
    const hd = cellOf(own.filter((g) => g.quality === 'hd'))
    return [
      {
        name: spec.name,
        basis: spec.basis,
        entries: own.length,
        standard,
        hd,
        standardPct: percentOf(standard.miss),
        hdPct: percentOf(hd.miss),
        unpriced: open.length,
        hidden: open.reduce((sum, g) => sum + g.estimate, 0),
      },
    ]
  })
  const models = rows.toSorted((a, b) => reach(b) - reach(a))
  const whole = cellOf(library)
  const widest = models
    .flatMap((m) =>
      (['standard', 'hd'] as const).flatMap((quality) => {
        const miss = m[quality].miss
        return miss === null ? [] : [{ name: m.name, quality, miss, basis: m.basis }]
      }),
    )
    .reduce<Summary['widest']>(
      (best, c) => (best === null || Math.abs(c.miss) > Math.abs(best.miss) ? c : best),
      null,
    )
  return {
    models,
    entries: library.length,
    unpriced: library.length - whole.priced,
    hidden: models.reduce((sum, m) => sum + m.hidden, 0),
    estimated: library.reduce((sum, g) => sum + g.estimate, 0),
    overall: whole.miss,
    widest,
  }
}

const SUMMARIES = new Map<Variant, Summary>()

/** The summary of the named variant; an unknown name is the rest library. The result keeps one identity per variant. */
export function summaryFor(fixture: string | undefined): Summary {
  const variant: Variant =
    fixture === 'exact' || fixture === 'extreme' || fixture === 'fresh' ? fixture : 'rest'
  const known = SUMMARIES.get(variant)
  if (known !== undefined) return known
  const made = summarize(generate(variant))
  SUMMARIES.set(variant, made)
  return made
}
