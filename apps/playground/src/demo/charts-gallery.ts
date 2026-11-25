/**
 * The data the `/charts` gallery draws: deterministic stand-ins shaped like the real thing, so every
 * shot of the page is the same picture. A seeded generator, never `Math.random`.
 */

/** A small seeded generator (mulberry32): the same seed gives the same sequence on every run. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
  }
}

const DAY_MS = 86_400_000
const utc = (y: number, m: number, d: number): number => Date.UTC(y, m - 1, d)

// ---- A long price history with a cycle score ---------------------------------------------

/** One reading of the price history: the close and the cycle score that colors it. */
export type PriceDay = {
  t: Date
  /** The close, USD. */
  price: number
  /** Where the price sits in its cycle, 0 (a bottom) to 100 (a top). */
  score: number
}

/** The halvings the history crosses, each an event on its time axis. */
export const HALVINGS = [
  { at: new Date(utc(2016, 7, 9)), label: 'Halving' },
  { at: new Date(utc(2020, 5, 11)), label: 'Halving' },
  { at: new Date(utc(2024, 4, 20)), label: 'Halving' },
] as const

const GENESIS = utc(2009, 1, 3)
const FIRST_DAY = utc(2013, 1, 1)
const LAST_DAY = utc(2026, 11, 20)
/** A reading every third day: ~1,700 points, years of history at a size a page draws at once. */
const STEP_DAYS = 3
/** Peaks land this many days after a halving. */
const PEAK_AFTER = 520
const CYCLE_DAYS = 1461
const HALVING_DAYS = [utc(2012, 11, 28), ...HALVINGS.map((h) => h.at.getTime())]

/** The power-law trend of the price, log10 USD, at a day. */
const trendAt = (t: number): number => -17.2 + 5.82 * Math.log10((t - GENESIS) / DAY_MS)

/** The cycle around the trend, log10: a peak `PEAK_AFTER` days past each halving, fading by era. */
function cycleAt(t: number): number {
  const last = HALVING_DAYS.findLast((h) => h <= t) ?? (HALVING_DAYS[0] as number)
  const era = HALVING_DAYS.indexOf(last)
  const amplitude = 0.62 - era * 0.11
  const days = (t - last) / DAY_MS
  return amplitude * Math.cos((2 * Math.PI * (days - PEAK_AFTER)) / CYCLE_DAYS)
}

function priceHistory(): PriceDay[] {
  const next = seeded(2140)
  const out: PriceDay[] = []
  let drift = 0
  for (let t = FIRST_DAY; t <= LAST_DAY; t += STEP_DAYS * DAY_MS) {
    drift = drift * 0.97 + (next() - 0.5) * 0.06
    const deviation = cycleAt(t) + drift
    const price = 10 ** (trendAt(t) + deviation)
    const score = 50 + 48 * Math.tanh(deviation / 0.32) + (next() - 0.5) * 4
    out.push({
      t: new Date(t),
      price: Math.round(price * 100) / 100,
      score: Math.round(Math.min(Math.max(score, 0), 100) * 10) / 10,
    })
  }
  return out
}

export const PRICE_HISTORY: readonly PriceDay[] = priceHistory()

// ---- A training block: load and resting heart rate ---------------------------------------

export type TrainingDay = {
  t: Date
  /** Training load, arbitrary units. */
  load: number
  loadMean: number
  /** Resting heart rate, beats per minute. */
  rhr: number
  rhrMean: number
}

/** The resting heart rate a rested athlete reads, bpm: a day above it by 4 or more is strained. */
export const RHR_BASELINE = 48

function trainingBlock(): TrainingDay[] {
  const next = seeded(48)
  const days = 84
  const raw = Array.from({ length: days }, (_, i) => {
    const week = Math.floor(i / 7)
    const deload = week % 4 === 3
    const session = i % 7 === 6 ? 0 : 1
    const load = session * (deload ? 45 : 70 + week * 6) * (0.75 + next() * 0.5)
    return { t: new Date(utc(2026, 8, 31) + i * DAY_MS), load: Math.round(load) }
  })
  const mean = (values: readonly number[]): number =>
    values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1)
  return raw
    .map((d, i) => {
      const window = raw.slice(Math.max(0, i - 6), i + 1).map((r) => r.load)
      const strain = mean(raw.slice(Math.max(0, i - 3), i).map((r) => r.load))
      const rhr = Math.round((RHR_BASELINE - 1 + strain / 22 + (next() - 0.5) * 2) * 10) / 10
      return { ...d, loadMean: Math.round(mean(window)), rhr, rhrMean: 0 }
    })
    .map((d, i, all) => ({
      ...d,
      rhrMean: Math.round(mean(all.slice(Math.max(0, i - 6), i + 1).map((r) => r.rhr)) * 10) / 10,
    }))
}

export const TRAINING: readonly TrainingDay[] = trainingBlock()

// ---- A quarter's operating income, step by step -------------------------------------------

export type IncomeStep = { name: string; amount: number }

/** Thousands of USD, signed: what moved operating income from Q2 to Q3. */
export const INCOME_BRIDGE: readonly IncomeStep[] = [
  { name: 'New sales', amount: 420 },
  { name: 'Expansion', amount: 185 },
  { name: 'Churn', amount: -160 },
  { name: 'Pricing', amount: 95 },
  { name: 'Hosting', amount: -140 },
  { name: 'Payroll', amount: -210 },
  { name: 'Marketing', amount: -85 },
]

export const INCOME_Q2 = 1240

// ---- Deploy failures by weekday and hour ------------------------------------------------

export type DeployCell = { day: string; hour: string; rate: number | null; deploys: number }

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
export const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'))

function deployGrid(): DeployCell[] {
  const next = seeded(24)
  return WEEKDAYS.flatMap((day, d) =>
    HOURS.map((hour, h) => {
      const working = d < 5 && h >= 8 && h <= 18
      const deploys = Math.round((working ? 9 : d < 5 ? 2 : 0.6) * (0.6 + next() * 0.8))
      if (deploys === 0) return { day, hour, rate: null, deploys }
      // Friday afternoons and the late-night hotfixes fail most.
      const risk = (d === 4 && h >= 14 ? 9 : 0) + (h >= 22 || h <= 2 ? 6 : 0) + 2.5
      return { day, hour, rate: Math.round((risk + next() * 4) * 10) / 10, deploys }
    }),
  )
}

export const DEPLOYS: readonly DeployCell[] = deployGrid()

/** Each weekday's measured failure rates: a cell's tooltip reads it against its day. */
const RATES_BY_DAY = new Map(
  WEEKDAYS.map((day) => [
    day,
    DEPLOYS.flatMap((c) => (c.day === day && c.rate !== null ? [c.rate] : [])),
  ]),
)

/** A cell read against its weekday: the day's average failure rate and the cell's rank in it. */
export function dayContext(cell: DeployCell): { label: string; value: string }[] {
  const rates = RATES_BY_DAY.get(cell.day as (typeof WEEKDAYS)[number]) ?? []
  if (cell.rate === null || rates.length < 2) return []
  const mean = rates.reduce((a, b) => a + b) / rates.length
  const rank = rates.filter((r) => r > (cell.rate as number)).length + 1
  return [
    { label: `${cell.day} average`, value: `${mean.toFixed(1)}%` },
    { label: 'Rank in day', value: `${rank} of ${rates.length}` },
  ]
}

// ---- Body weight against a target --------------------------------------------------------

export type WeighIn = { t: Date; weight: number | null; mean: number }

/** The weight the cut aims for, kg. */
export const WEIGHT_TARGET = 80

function weighIns(): WeighIn[] {
  const next = seeded(80)
  const days = 70
  const raw = Array.from({ length: days }, (_, i) => {
    const trend = 84.2 - i * 0.055 - (i > 35 ? (i - 35) * 0.02 : 0)
    const weight = i % 9 === 4 ? null : Math.round((trend + (next() - 0.5) * 1.1) * 10) / 10
    return { t: new Date(utc(2026, 9, 15) + i * DAY_MS), weight }
  })
  return raw.map((d, i) => {
    const window = raw
      .slice(Math.max(0, i - 6), i + 1)
      .flatMap((r) => (r.weight === null ? [] : [r.weight]))
    const mean = window.reduce((a, b) => a + b, 0) / Math.max(window.length, 1)
    return { ...d, mean: Math.round(mean * 100) / 100 }
  })
}

export const WEIGH_INS: readonly WeighIn[] = weighIns()

/** The day the cut started: an event on the weight chart's axis. */
export const CUT_START = new Date(utc(2026, 11, 1))
