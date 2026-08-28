/**
 * CBBI — the Colin Talks Crypto Bitcoin Bull Run Index, as REAL data.
 *
 * The playground's other pages all run on deterministic fixtures (`demo/data.ts`,
 * `demo/analytics-data.ts`). This one deliberately does not: the page it feeds is the evidence
 * surface for a future right-hand aside, and an aside is judged on what a real distribution does
 * to it — 5,541 daily points from 2011-06-27, nine sub-metrics with genuine leading nulls, and a
 * price series spanning four orders of magnitude.
 *
 * Upstream shape (`https://colintalkscrypto.com/cbbi/data/latest.json`, CORS `*`, ~1.5 MB):
 * eleven flat maps keyed by unix SECONDS as strings — `Price`, the nine metrics, and the official
 * `Confidence`. Every map carries the same key set. A metric is `0..1` or `null`; the official
 * confidence is the plain arithmetic mean of that day's non-null metrics (upstream
 * `pl.mean_horizontal`), which is what `computeConfidence` generalizes with weights.
 *
 * No framework import here — plain data and pure functions, so the page can be read without it.
 */

/** The nine sub-metrics, in the order the upstream site lists them. */
export const CBBI_METRICS = [
  {
    key: 'PiCycle',
    label: 'Pi Cycle Top',
    hint: 'The 111-day MA crossing twice the 350-day MA — a top signal that has called three cycles.',
  },
  {
    key: 'RUPL',
    label: 'Relative Unrealized P/L',
    hint: 'Net unrealized profit or loss held across all coins, as a share of market cap.',
  },
  {
    key: 'RHODL',
    label: 'RHODL Ratio',
    hint: 'Realized value of 1-week-old coins against 1-to-2-year-old coins.',
  },
  {
    key: 'Puell',
    label: 'Puell Multiple',
    hint: 'Daily miner issuance in dollars against its own 365-day average.',
  },
  {
    key: '2YMA',
    label: '2-Year MA Multiplier',
    hint: 'Price against the 2-year moving average and a 5× overlay of it.',
  },
  {
    key: 'Trolololo',
    label: 'Trolololo Trend Line',
    hint: "Price against the logarithmic regression band of Bitcoin's whole history.",
  },
  {
    key: 'MVRV',
    label: 'MVRV Z-Score',
    hint: 'Market value against realized value, standardized — how stretched price is from cost basis.',
  },
  {
    key: 'ReserveRisk',
    label: 'Reserve Risk',
    hint: 'Confidence of long-term holders weighed against the price they are being paid to sell.',
  },
  {
    key: 'Woobull',
    label: 'Woobull Top Cap vs CVDD',
    hint: 'Price inside the Top Cap / CVDD channel — the historical ceiling and floor pair.',
  },
] as const

export type CbbiMetricKey = (typeof CBBI_METRICS)[number]['key']

/** The keys alone — the enum a `field.multi` and every `Record` below is built over. */
export const CBBI_METRIC_KEYS = CBBI_METRICS.map((m) => m.key) as readonly CbbiMetricKey[]

export const CBBI_METRIC_LABEL: Record<CbbiMetricKey, string> = Object.fromEntries(
  CBBI_METRICS.map((m) => [m.key, m.label]),
) as Record<CbbiMetricKey, string>

/** One day (or one bucket, after `bucketRows`) of the index. */
export type CbbiRow = {
  /** Unix MILLIseconds — the upstream keys are seconds, converted once in `parseCbbi`. */
  t: number
  /**
   * `t` as a UTC `YYYY-MM-DD`, stamped ONCE at parse.
   *
   * It is the chart's x key and the tooltip header, so `isoDay(row.t)` per row per render meant a
   * `Date` allocation and an ISO format for every one of 5,541 points, times every chart on the
   * page, on every commit. Derived rather than stored would be the cleaner type and the wrong
   * trade at this size.
   */
  day: string
  price: number
  /** The OFFICIAL index, 0..1, as published. `computeConfidence` is the reweighted analog. */
  confidence: number
  metrics: Record<CbbiMetricKey, number | null>
}

/** The zone a confidence reading lands in — the 0.1 / 0.9 bands the whole page is drawn around. */
export type CbbiZone = 'bottom' | 'mid' | 'peak'

export const CBBI_BOTTOM = 0.1
export const CBBI_PEAK = 0.9

export function zoneOf(confidence: number): CbbiZone {
  if (confidence >= CBBI_PEAK) return 'peak'
  if (confidence <= CBBI_BOTTOM) return 'bottom'
  return 'mid'
}

// ── Parsing ──────────────────────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * One upstream series, validated. Throws rather than coercing: a silently-dropped metric would
 * shift the mean and the page would report a confident wrong number, which is the one failure mode
 * worse than an error state.
 */
function readSeries(raw: Record<string, unknown>, name: string): Record<string, number | null> {
  const series = raw[name]
  if (!isRecord(series)) throw new Error(`CBBI: missing or malformed series "${name}"`)
  for (const [key, value] of Object.entries(series)) {
    if (value === null) continue
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw new Error(`CBBI: series "${name}" holds a non-numeric value at ${key}`)
    }
  }
  return series as Record<string, number | null>
}

/**
 * Validate the upstream payload and flatten it into one ascending row per day.
 *
 * A day is kept only when BOTH `Price` and `Confidence` are numbers — a row with no price cannot
 * be plotted and a row with no official index cannot be compared against a reweighted one. A
 * metric's `null` survives into `row.metrics` untouched: the leading gaps (PiCycle's first 349
 * days, Puell's 20, ReserveRisk's 1, Woobull's 2 plus its trailing one) are exactly what
 * `computeConfidence` has to keep excluding.
 */
export function parseCbbi(raw: unknown): CbbiRow[] {
  if (!isRecord(raw)) throw new Error('CBBI: payload is not an object')

  const price = readSeries(raw, 'Price')
  const confidence = readSeries(raw, 'Confidence')
  const metricSeries = CBBI_METRIC_KEYS.map((key) => [key, readSeries(raw, key)] as const)

  const rows: CbbiRow[] = []
  for (const [key, priceValue] of Object.entries(price)) {
    const seconds = Number(key)
    if (!Number.isFinite(seconds)) throw new Error(`CBBI: non-numeric timestamp key "${key}"`)
    const confidenceValue = confidence[key]
    if (priceValue === null || confidenceValue === null || confidenceValue === undefined) continue

    const metrics = {} as Record<CbbiMetricKey, number | null>
    for (const [metricKey, series] of metricSeries) metrics[metricKey] = series[key] ?? null

    const t = seconds * 1000
    rows.push({ t, day: isoDay(t), price: priceValue, confidence: confidenceValue, metrics })
  }

  if (rows.length === 0) throw new Error('CBBI: payload carried no usable rows')
  rows.sort((a, b) => a.t - b.t)
  return rows
}

const CBBI_URL = 'https://colintalkscrypto.com/cbbi/data/latest.json'

/** Fetch + validate. The error message reaches `QueryState`'s error branch verbatim. */
export async function fetchCbbi(): Promise<CbbiRow[]> {
  const response = await fetch(CBBI_URL)
  if (!response.ok)
    throw new Error(`CBBI request failed: ${response.status} ${response.statusText}`)
  return parseCbbi(await response.json())
}

// ── Derivation ───────────────────────────────────────────────────────────────────────────────────

/**
 * The reweighted index: a weighted mean over the metrics that are BOTH enabled and non-null that
 * day. With every metric enabled at weight 1 it reproduces the official `Confidence` exactly (the
 * upstream mean is the unweighted case). Returns `null` when nothing enabled has a reading — an
 * early day with only nulls, or an empty selection.
 */
export function computeConfidence(
  row: CbbiRow,
  weights: Record<CbbiMetricKey, number>,
  enabled: ReadonlySet<CbbiMetricKey>,
): number | null {
  let weighted = 0
  let total = 0
  for (const key of CBBI_METRIC_KEYS) {
    if (!enabled.has(key)) continue
    const value = row.metrics[key]
    if (value === null) continue
    const weight = weights[key]
    if (weight <= 0) continue
    weighted += value * weight
    total += weight
  }
  return total === 0 ? null : weighted / total
}

export type CbbiGrain = 'day' | 'week' | 'month'

/** UTC `YYYY-MM-DD` — the upstream stamps are UTC midnight, so a local read shifts a day. */
export function isoDay(t: number): string {
  return new Date(t).toISOString().slice(0, 10)
}

/** UTC `YYYY-MM` — the heatmap's column key and the month bucket's identity. */
export function isoMonth(t: number): string {
  return new Date(t).toISOString().slice(0, 7)
}

function bucketKey(t: number, grain: CbbiGrain): string {
  if (grain === 'month') return isoMonth(t)
  if (grain === 'day') return isoDay(t)
  // Week = the UTC Monday the day falls in. `getUTCDay()` is 0 on Sunday, so shift by 6 there.
  const date = new Date(t)
  const day = date.getUTCDay()
  date.setUTCDate(date.getUTCDate() - (day === 0 ? 6 : day - 1))
  return isoDay(date.getTime())
}

/**
 * Fold daily rows into weekly or monthly ones.
 *
 * ONE rule, stated once because the two halves differ deliberately: **price and the official
 * confidence take the LAST reading in the bucket** (the closing value a reader of a weekly chart
 * expects, and the only one that still matches the published number on the final bucket), while
 * **each metric takes the arithmetic MEAN of its non-null readings** (a metric is a normalized
 * 0..1 position, and a mean is what keeps a bucket's reweighted confidence from swinging on one
 * day's spike). A bucket whose metric is null throughout stays null.
 *
 * The consequence is intentional and visible on the page: a reweighted confidence at `week`/`month`
 * is a mean-of-means and will not land exactly on the official last-of-bucket line even at
 * unweighted defaults. At `day` the two agree to the published digit.
 */
export function bucketRows(rows: readonly CbbiRow[], grain: CbbiGrain): CbbiRow[] {
  if (grain === 'day') return rows.slice()

  const buckets = new Map<string, CbbiRow[]>()
  for (const row of rows) {
    const key = bucketKey(row.t, grain)
    const bucket = buckets.get(key)
    if (bucket) bucket.push(row)
    else buckets.set(key, [row])
  }

  const out: CbbiRow[] = []
  for (const bucket of buckets.values()) {
    const last = bucket[bucket.length - 1]
    if (!last) continue
    const metrics = {} as Record<CbbiMetricKey, number | null>
    for (const key of CBBI_METRIC_KEYS) {
      let sum = 0
      let count = 0
      for (const row of bucket) {
        const value = row.metrics[key]
        if (value === null) continue
        sum += value
        count += 1
      }
      metrics[key] = count === 0 ? null : sum / count
    }
    out.push({ t: last.t, day: last.day, price: last.price, confidence: last.confidence, metrics })
  }
  out.sort((a, b) => a.t - b.t)
  return out
}

export type CbbiRangePreset = '1y' | '2y' | '4y' | 'all'

const RANGE_YEARS: Record<Exclude<CbbiRangePreset, 'all'>, number> = { '1y': 1, '2y': 2, '4y': 4 }

/** Trailing window measured back from the LAST row, not from `Date.now()` — the series ends today,
 * and anchoring on the data keeps a stale cache from rendering an empty window. */
export function rowsInRange(rows: readonly CbbiRow[], preset: CbbiRangePreset): CbbiRow[] {
  if (preset === 'all') return rows.slice()
  const last = rows[rows.length - 1]
  if (!last) return []
  const from = new Date(last.t)
  from.setUTCFullYear(from.getUTCFullYear() - RANGE_YEARS[preset])
  const cutoff = from.getTime()
  return rows.filter((row) => row.t >= cutoff)
}

// ── Small numeric helpers ────────────────────────────────────────────────────────────────────────

export type HistogramBin = {
  /** Domain key — the bin's lower bound, formatted, so it reads as an axis category. */
  key: string
  from: number
  to: number
  count: number
}

/**
 * Equal-width bins over `[min, max]` of the input. The last bin is closed on the right so the
 * maximum lands inside it rather than in a phantom bin past the end.
 */
export function histogram(values: readonly number[], bins: number): HistogramBin[] {
  if (bins <= 0 || values.length === 0) return []
  let min = Infinity
  let max = -Infinity
  for (const value of values) {
    if (value < min) min = value
    if (value > max) max = value
  }
  const span = max - min || 1
  const width = span / bins

  const out: HistogramBin[] = []
  for (let i = 0; i < bins; i++) {
    const from = min + i * width
    out.push({ key: from.toFixed(2), from, to: from + width, count: 0 })
  }
  for (const value of values) {
    const index = Math.min(bins - 1, Math.floor((value - min) / width))
    const bin = out[index]
    if (bin) bin.count += 1
  }
  return out
}

/** `0.4077` → `41%`. The index is read as a percentage everywhere it is stated. */
export function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

/** `0.4077` → `0.408`. The mono reading in the panel and the table, where the third digit matters. */
export function ratio(value: number): string {
  return value.toFixed(3)
}

const USD = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export function money(value: number): string {
  return `$${USD.format(Math.round(value))}`
}

/** `2026-08-28` → `Aug 26` — an axis tick that stays legible across a four-year window. */
export function fmtMonthTick(key: string): string {
  const date = new Date(`${key}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return key
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' })
}

/** Percent change from `before` to `after`, the sign `DeltaBadge` wants. */
export function deltaPct(after: number, before: number): number | undefined {
  if (before === 0 || !Number.isFinite(before)) return undefined
  return ((after - before) / Math.abs(before)) * 100
}
