/**
 * Everything the CBBI page DERIVES, as pure functions over `CbbiRow[]` — kept out of the component
 * for the reason `demo/analytics-data.ts` is: a re-render caused by opening a filter sheet must not
 * reshuffle the numbers behind it, and a derivation that lives in a `useMemo` body is a derivation
 * nothing else can read.
 */
import {
  CBBI_METRIC_KEYS,
  CBBI_METRIC_LABEL,
  CBBI_PEAK,
  computeConfidence,
  deltaPct,
  isoMonth,
  money,
  ratio,
  zoneOf,
} from './cbbi-data'
import type { CbbiMetricKey, CbbiRow, CbbiZone } from './cbbi-data'
import { createColumnHelper } from 'basalt-ui/data'

/** One plotted point. `plotPrice` is what the y-axis actually reads (see `buildPoints`). */
export type CbbiPoint = {
  /** `YYYY-MM-DD` — the shared cursor key, and what the tooltip header parses back into a date. */
  key: string
  price: number
  plotPrice: number
  official: number
  custom: number | null
}

export type CbbiScale = 'log' | 'linear'

/**
 * The plotted series.
 *
 * **The chart layer has no log scale** (`AxisConfig` is linear-only, `CartesianChart` builds a
 * `scaleLinear`), so `scale: 'log'` is expressed in the DATA: `plotPrice` is `log10(price)` and the
 * axis formatter maps each tick back through `10 ** v` before printing it. The ticks are therefore
 * chosen in log space and land on unround dollar figures — honest, readable, and the visible cost
 * of the missing scale option.
 */
export function buildPoints(
  rows: readonly CbbiRow[],
  weights: Record<CbbiMetricKey, number>,
  enabled: ReadonlySet<CbbiMetricKey>,
  scale: CbbiScale,
): CbbiPoint[] {
  return rows.map((row) => ({
    key: row.day,
    price: row.price,
    plotPrice: scale === 'log' ? Math.log10(Math.max(row.price, 1e-6)) : row.price,
    official: row.confidence,
    custom: computeConfidence(row, weights, enabled),
  }))
}

/** The four headline figures, read off the DAILY series so they state today, not this week. */
export type CbbiSummary = {
  latest: CbbiRow
  zone: CbbiZone
  official: number
  custom: number | null
  /** Percentage-POINT gap between the reweighted index and the official one. */
  customGap: number | null
  officialDelta: number | undefined
  price: number
  priceDelta: number | undefined
  /** Last 90 daily closes — the price card's sparkline. */
  priceHistory: number[]
  hotKeys: CbbiMetricKey[]
}

const LOOKBACK_DAYS = 30
const SPARK_DAYS = 90

export function buildSummary(
  rows: readonly CbbiRow[],
  weights: Record<CbbiMetricKey, number>,
  enabled: ReadonlySet<CbbiMetricKey>,
): CbbiSummary | null {
  const latest = rows[rows.length - 1]
  if (!latest) return null
  const before = rows[rows.length - 1 - LOOKBACK_DAYS]
  const custom = computeConfidence(latest, weights, enabled)

  const hotKeys = CBBI_METRIC_KEYS.filter((key) => (latest.metrics[key] ?? 0) >= CBBI_PEAK)

  return {
    latest,
    zone: zoneOf(latest.confidence),
    official: latest.confidence,
    custom,
    customGap: custom === null ? null : (custom - latest.confidence) * 100,
    officialDelta: before ? deltaPct(latest.confidence, before.confidence) : undefined,
    price: latest.price,
    priceDelta: before ? deltaPct(latest.price, before.price) : undefined,
    priceHistory: rows.slice(-SPARK_DAYS).map((row) => row.price),
    hotKeys,
  }
}

/**
 * Whether the panel is still at the published composition — every metric enabled at weight 1.
 *
 * The overview asks this rather than comparing the two plotted lines, because at `week`/`month`
 * they differ for a reason that is NOT a reweighting: `bucketRows` folds price and the official
 * index by last-of-bucket and each metric by mean, so a mean-of-means never lands exactly on the
 * published closing figure. Drawing a second "Reweighted" line for that artifact would claim a
 * difference the reader did not make.
 */
export function isDefaultComposition(
  weights: Record<CbbiMetricKey, number>,
  enabled: ReadonlySet<CbbiMetricKey>,
): boolean {
  return CBBI_METRIC_KEYS.every((key) => enabled.has(key) && weights[key] === 1)
}

export function hotMetricNames(keys: readonly CbbiMetricKey[]): string {
  if (keys.length === 0) return 'No metric is in the top zone'
  return keys.map((key) => CBBI_METRIC_LABEL[key]).join(' · ')
}

// ── History view ─────────────────────────────────────────────────────────────────────────────────

export type CbbiHeatCell = { year: string; month: string; value: number }

const MONTH_LABELS = [
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
]

export const CBBI_HEAT_COLS: readonly string[] = MONTH_LABELS

/** Mean official confidence per calendar month, as heatmap cells (row = year, col = month). */
export function monthlyHeat(rows: readonly CbbiRow[]): CbbiHeatCell[] {
  const sums = new Map<string, { sum: number; count: number }>()
  for (const row of rows) {
    const key = isoMonth(row.t)
    const entry = sums.get(key)
    if (entry) {
      entry.sum += row.confidence
      entry.count += 1
    } else {
      sums.set(key, { sum: row.confidence, count: 1 })
    }
  }

  const cells: CbbiHeatCell[] = []
  for (const [key, { sum, count }] of sums) {
    const year = key.slice(0, 4)
    const monthIndex = Number(key.slice(5, 7)) - 1
    const month = MONTH_LABELS[monthIndex]
    if (month === undefined) continue
    cells.push({ year, month, value: sum / count })
  }
  return cells
}

export function heatYears(cells: readonly CbbiHeatCell[]): string[] {
  return [...new Set(cells.map((cell) => cell.year))].toSorted()
}

/** One monthly row of the history table — the metrics flattened so a column can name one. */
export type CbbiMonthRow = {
  month: string
  price: number
  confidence: number
  metrics: Record<CbbiMetricKey, number | null>
}

/** The last `count` monthly buckets, newest first — a table is read from the top. */
export function monthlyTable(monthRows: readonly CbbiRow[], count: number): CbbiMonthRow[] {
  return monthRows
    .slice(-count)
    .toReversed()
    .map((row) => ({
      month: isoMonth(row.t),
      price: row.price,
      confidence: row.confidence,
      metrics: row.metrics,
    }))
}

// ── History table columns ────────────────────────────────────────────────────────────────────────

/**
 * The monthly table's columns — beside the data, never in the page, for the reason
 * `demo/analytics-data.ts` states: a column def is data about the rows. Every numeric column is
 * right-aligned and states its own formatter; a metric with no reading that month prints `—`
 * rather than an empty cell, so a gap reads as a gap.
 */
const col = createColumnHelper<CbbiMonthRow>()

export const cbbiMonthColumns = [
  col.accessor('month', { header: 'Month' }),
  col.accessor('price', {
    header: 'Price',
    meta: { align: 'right' },
    cell: (info) => money(info.getValue()),
  }),
  col.accessor('confidence', {
    header: 'CBBI',
    meta: { align: 'right' },
    cell: (info) => ratio(info.getValue()),
  }),
  ...CBBI_METRIC_KEYS.map((key) =>
    col.accessor((row) => row.metrics[key], {
      id: key,
      header: CBBI_METRIC_LABEL[key],
      meta: { align: 'right' as const },
      cell: (info) => {
        const value = info.getValue()
        return value === null ? '—' : ratio(value)
      },
    }),
  ),
]
