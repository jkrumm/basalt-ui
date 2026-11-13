/**
 * n05 fixture: 25 language models, each with a blended price (USD per 1M tokens, 3:1 input to
 * output) and a composite quality score (0-100). Hand-authored and fixed: no randomness, no clock.
 * Every figure below is a stand-in for a benchmark table the engineer would otherwise read by eye.
 */

export type Size = 'Small' | 'Medium' | 'Large'

/** The families that earn a colour; every other family folds into `other`. */
export const FAMILIES = [
  { key: 'atlas', label: 'Atlas' },
  { key: 'boreal', label: 'Boreal' },
  { key: 'cinder', label: 'Cinder' },
  { key: 'dune', label: 'Dune' },
  { key: 'ember', label: 'Ember' },
  { key: 'flint', label: 'Flint' },
  { key: 'grove', label: 'Grove' },
  { key: 'other', label: 'Other families' },
] as const

export type FamilyKey = (typeof FAMILIES)[number]['key']

type RawModel = {
  family: string
  series: FamilyKey
  size: Size | null
  /** The model's own name after the family: a size word or a product name. */
  variant: string
  price: number
  quality: number
}

const raw = (
  family: string,
  series: FamilyKey,
  size: Size | null,
  variant: string,
  price: number,
  quality: number,
): RawModel => ({ family, series, size, variant, price, quality })

const RAW_MODELS: readonly RawModel[] = [
  raw('Atlas', 'atlas', 'Small', 'Small', 0.4, 58),
  raw('Atlas', 'atlas', 'Medium', 'Medium', 3.5, 78),
  raw('Atlas', 'atlas', 'Large', 'Large', 18, 89),
  raw('Boreal', 'boreal', 'Small', 'Small', 0.15, 55),
  raw('Boreal', 'boreal', 'Medium', 'Medium', 1.1, 74),
  raw('Boreal', 'boreal', 'Large', 'Large', 9, 90),
  raw('Cinder', 'cinder', 'Small', 'Small', 0.6, 52),
  raw('Cinder', 'cinder', 'Medium', 'Medium', 5.5, 76),
  raw('Cinder', 'cinder', 'Large', 'Large', 45, 88),
  raw('Dune', 'dune', 'Small', 'Small', 0.09, 48),
  raw('Dune', 'dune', 'Medium', 'Medium', 0.7, 66),
  raw('Dune', 'dune', 'Large', 'Large', 4.8, 82),
  raw('Ember', 'ember', 'Small', 'Small', 0.3, 50),
  raw('Ember', 'ember', 'Medium', 'Medium', 2.2, 72),
  raw('Ember', 'ember', 'Large', 'Large', 24, 86),
  raw('Flint', 'flint', 'Small', 'Small', 0.12, 46),
  raw('Flint', 'flint', 'Medium', 'Medium', 1.8, 70),
  raw('Flint', 'flint', 'Large', 'Large', 12, 85),
  raw('Grove', 'grove', null, 'Lite', 0.2, 52),
  raw('Grove', 'grove', null, 'Pro', 6.5, 80),
  raw('Helix', 'other', null, 'Mini', 0.05, 40),
  raw('Helix', 'other', null, 'Max', 30, 93),
  // Weights served with no API charge: the zero price the log axis cannot place.
  raw('Juno', 'other', null, 'Open', 0, 44),
  raw('Kestrel', 'other', null, 'Kestrel', 0.35, 62),
  raw('Lumen', 'other', null, 'Lumen', 2, 77),
]

/** Prices and scores are read from this date; the page says so and nothing else is dated. */
export const AS_OF_LABEL = '1 Nov 2026'

/** Where a free model sits on the log axis: a price the axis can place, ticked as "Free". */
export const FREE_AT = 0.02
export const X_FREE = Math.log10(FREE_AT)

export type Beater = {
  name: string
  short: string
  /** USD per 1M tokens the beaten model costs on top of its beater. */
  extra: number
  /** Quality points the beater scores above the beaten model. */
  gain: number
}

export type Model = {
  name: string
  short: string
  family: string
  series: FamilyKey
  size: Size | null
  price: number
  quality: number
  /** log10 of the price, the chart's x; a free model sits at {@link X_FREE}. */
  x: number
  /** No model costs less and scores at least as much. */
  frontier: boolean
  /** The cheapest model that scores at least as much for less; null on the frontier. */
  beatenBy: Beater | null
}

const nameOf = (r: RawModel, short: boolean): string => {
  if (r.size === null) return r.family === r.variant ? r.family : `${r.family} ${r.variant}`
  return `${r.family} ${short ? r.size.slice(0, 1) : r.size}`
}

/**
 * Derives the frontier and each beaten model's beater. Prices must be unique: the chart's cursor
 * walks the x order, and two models at one price would be one stop.
 */
export function analyse(models: readonly RawModel[]): Model[] {
  const prices = new Set(models.map((m) => m.price))
  if (prices.size !== models.length) throw new Error('n05 fixture prices must be unique')
  const sorted = models.toSorted((a, b) => a.price - b.price)
  const named = sorted.map((m) => ({ m, name: nameOf(m, false), short: nameOf(m, true) }))
  return named.map(({ m, name, short }) => {
    const cheaper = named.filter((o) => o.m.price < m.price && o.m.quality >= m.quality)
    const best = cheaper[0]
    return {
      name,
      short,
      family: m.family,
      series: m.series,
      size: m.size,
      price: m.price,
      quality: m.quality,
      x: m.price === 0 ? X_FREE : Math.log10(m.price),
      frontier: best === undefined,
      beatenBy:
        best === undefined
          ? null
          : {
              name: best.name,
              short: best.short,
              extra: m.price - best.m.price,
              gain: best.m.quality - m.quality,
            },
    }
  })
}

/** Cheapest first: the x order, so the chart's keyboard walk and the table's rest order agree. */
export const MODELS: readonly Model[] = analyse(RAW_MODELS)

export const X_MIN = X_FREE - 0.15
export const Y_MIN = 30
export const Y_MAX = 100
/** The decade ticks and the free position; the tick at {@link X_FREE} reads "Free". */
export const X_TICKS: readonly number[] = [X_FREE, -1, 0, 1]

export type View = {
  models: readonly Model[]
  frontier: readonly Model[]
  /** Widest price gap to the beater first. */
  beaten: readonly Model[]
  /** The staircase: flat to the next frontier price, then up; empty with no model. */
  steps: readonly { x: number; y: number }[]
  xMax: number
  /** Where the axis breaks between "Free" and the cheapest priced model; null with no free model. */
  breakAt: number | null
  /** The frontier model the most other models are beaten by; null when nothing is beaten. */
  leader: { model: Model; beats: number; avgExtra: number; avgGain: number } | null
}

/** Everything the page reads off a model list: zero, one and all-frontier lists included. */
export function buildView(models: readonly Model[]): View {
  const frontier = models.filter((m) => m.frontier)
  const beaten = models
    .filter((m) => !m.frontier)
    .toSorted((a, b) => (b.beatenBy?.extra ?? 0) - (a.beatenBy?.extra ?? 0))
  const last = frontier[frontier.length - 1]
  const steps =
    last === undefined
      ? []
      : [...frontier.map((m) => ({ x: m.x, y: m.quality })), { x: 0, y: last.quality }]
  const priced = models.filter((m) => m.price > 0)
  const xMax = priced.length === 0 ? 1 : Math.log10(Math.max(...priced.map((m) => m.price))) + 0.2
  const cheapest = priced[0]
  const hasFree = models.some((m) => m.price === 0)
  const leader = frontier
    .map((model) => {
      const beatenByIt = beaten.filter((m) => m.beatenBy?.name === model.name)
      const beats = beatenByIt.length
      const mean = (pick: (b: Beater) => number): number =>
        beats === 0
          ? 0
          : beatenByIt.reduce((sum, m) => sum + (m.beatenBy === null ? 0 : pick(m.beatenBy)), 0) /
            beats
      return { model, beats, avgExtra: mean((b) => b.extra), avgGain: mean((b) => b.gain) }
    })
    .filter((l) => l.beats > 0)
    .toSorted((a, b) => b.beats - a.beats || b.model.quality - a.model.quality)[0]
  return {
    models,
    frontier,
    beaten,
    steps: steps.map((p, i) => (i === steps.length - 1 ? { ...p, x: xMax } : p)),
    xMax,
    breakAt: hasFree && cheapest !== undefined ? (X_FREE + cheapest.x) / 2 : null,
    leader: leader ?? null,
  }
}

export const VIEW: View = buildView(MODELS)

export const fmtPrice = (price: number): string => (price === 0 ? 'Free' : `$${price.toFixed(2)}`)
export const fmtPerMillion = (price: number): string =>
  price === 0 ? 'Free' : `${fmtPrice(price)} per 1M tokens`
export const fmtTick = (price: number): string => `$${+price.toPrecision(2)}`
export const fmtExtra = (extra: number): string => `+$${extra.toFixed(2)}`

/** The chart's frame height per container class; the card reserves the same box while pending. */
export const CHART_HEIGHT = { base: 280, regular: 380, wide: 440 } as const

/** The loading skeleton's dots: a fixed rising band across the plot, no model data. */
export const GHOST: readonly Model[] = Array.from({ length: 14 }, (_, i) => ({
  name: `placeholder ${i}`,
  short: '',
  family: '',
  series: 'other' as const,
  size: 'Medium' as const,
  price: 1,
  quality: 46 + i * 3 + (i % 3) * 4,
  x: -1.5 + i * 0.24 + (i % 4) * 0.03,
  frontier: false,
  beatenBy: null,
}))
