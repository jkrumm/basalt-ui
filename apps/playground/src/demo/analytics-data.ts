/**
 * Deterministic fixture for the analytics dashboard (`demo/DashboardPage.tsx`), plus the table
 * columns that describe its rows.
 *
 * Everything is a pure function of the filter state, so the page never calls `Math.random()` at
 * render — a re-render caused by opening a filter sheet must not reshuffle the numbers underneath
 * it. The waves are plain trigonometry over the point index: same input, same series, every time.
 */

import { createColumnHelper } from 'basalt-ui/data'

export const CHANNEL_KEYS = ['direct', 'organic', 'referral', 'social', 'paid'] as const
export type ChannelKey = (typeof CHANNEL_KEYS)[number]

/** The dashboard store's range field, including the `'custom'` preset `custom: true` adds. */
export type AnalyticsRange = '1d' | '7d' | '30d' | 'custom'
export type Currency = 'USD' | 'EUR'
export type CompareMode = 'none' | 'previous' | 'year'

export type SalesPoint = { date: string; sales: number; previous: number }
export type Kpi = {
  key: string
  title: string
  value: string
  /** Absent when `compare` is `'none'` — there is no comparison window, so there is no delta. */
  delta?: number
  history: number[]
}
export type BreakdownRow = { key: ChannelKey; label: string; value: string; history: number[] }
export type FunnelPoint = { step: string; visitors: number }
export type TopPage = { path: string; views: number; conversion: number; revenue: number }

export type Analytics = {
  points: SalesPoint[]
  total: string
  /** Absent when `compare` is `'none'`, for the same reason a KPI's is. */
  delta?: number
  /** The badge suffix every delta on the page reads — never `'MoM'`, which the window may not be. */
  deltaPeriod?: string
  kpis: Kpi[]
  breakdown: BreakdownRow[]
  funnel: FunnelPoint[]
  retention: SalesPoint[]
  latency: SalesPoint[]
  topPages: TopPage[]
}

const CHANNEL_LABEL: Record<ChannelKey, string> = {
  direct: 'Direct',
  organic: 'Organic search',
  referral: 'Referral',
  social: 'Social',
  paid: 'Paid',
}

/** Per-channel share of total sales, and the phase that shapes its own trend. */
const CHANNEL_WEIGHT: Record<ChannelKey, { share: number; phase: number }> = {
  direct: { share: 0.34, phase: 0 },
  organic: { share: 0.27, phase: 1.1 },
  referral: { share: 0.17, phase: 2.2 },
  social: { share: 0.13, phase: 3.3 },
  paid: { share: 0.09, phase: 4.4 },
}

const CURRENCY_SYMBOL: Record<Currency, string> = { USD: '$', EUR: '€' }
/** Fixed conversion, so switching currency changes the numbers visibly and reproducibly. */
const CURRENCY_RATE: Record<Currency, number> = { USD: 1, EUR: 0.92 }

/** Point count and label shape per range — `'custom'` reads as the 30-day window. */
function shape(range: AnalyticsRange): { count: number; hourly: boolean } {
  if (range === '1d') return { count: 24, hourly: true }
  if (range === '7d') return { count: 7, hourly: false }
  return { count: 30, hourly: false }
}

function label(index: number, count: number, hourly: boolean): string {
  if (hourly) return `${String(index).padStart(2, '0')}:00`
  // Days counted back from 2026-08-27, so the axis reads left-to-right oldest-to-newest.
  const day = new Date(Date.UTC(2026, 7, 27) - (count - 1 - index) * 86_400_000)
  return day.toISOString().slice(0, 10)
}

/** Bounded, smooth, seedless — two out-of-phase sines so the curve never looks periodic. */
function wave(index: number, phase: number): number {
  return 1 + 0.28 * Math.sin(index * 0.55 + phase) + 0.12 * Math.sin(index * 0.21 + phase * 1.7)
}

function money(value: number, currency: Currency): string {
  const scaled = value * CURRENCY_RATE[currency]
  const symbol = CURRENCY_SYMBOL[currency]
  if (scaled >= 1000) return `${symbol}${(scaled / 1000).toFixed(1)}k`
  return `${symbol}${Math.round(scaled).toLocaleString('en-US')}`
}

function percent(value: number): string {
  return `${value.toFixed(1)}%`
}

function integer(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

/** Sums a series' `sales`, so a KPI and its sparkline can never disagree. */
function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/**
 * Percent change of one measured total against its comparison total, to one decimal.
 *
 * Every delta on the page goes through here, which is the point: a hardcoded `+12.4%` beside a
 * comparison series that says otherwise is the exact class of dashboard lie this page exists to not
 * tell. A zero (or absent) prior has no percentage, so it has no delta.
 */
function change(current: number, prior: number): number | undefined {
  if (prior <= 0) return undefined
  return Number((((current - prior) / prior) * 100).toFixed(1))
}

/**
 * The delta badge's suffix. Read from the COMPARE field, never from the range — a 24-hour window
 * compared against the previous one is not `MoM`, and printing it anyway is how a badge stops
 * meaning anything.
 */
export function deltaPeriodLabel(compare: CompareMode): string | undefined {
  if (compare === 'none') return undefined
  return compare === 'year' ? 'YoY' : 'vs prior'
}

/** `{ delta }` when there is a comparison to make, `{}` otherwise — spreadable into a card. */
function deltaOf(o: { compare: CompareMode; current: number; prior: number }): { delta?: number } {
  if (o.compare === 'none') return {}
  const delta = change(o.current, o.prior)
  return delta === undefined ? {} : { delta }
}

function series(o: {
  count: number
  hourly: boolean
  base: number
  phase: number
  priorFactor: number
}): SalesPoint[] {
  return Array.from({ length: o.count }, (_, index) => ({
    date: label(index, o.count, o.hourly),
    sales: Math.round(o.base * wave(index, o.phase)),
    previous: Math.round(o.base * o.priorFactor * wave(index + 3, o.phase)),
  }))
}

const FUNNEL_STEPS = ['Visited', 'Viewed item', 'Added to cart', 'Checkout', 'Purchased'] as const
const FUNNEL_RETENTION = [1, 0.62, 0.34, 0.21, 0.14] as const

const TOP_PATHS = [
  '/pricing',
  '/features/analytics',
  '/blog/reading-dashboards',
  '/docs/getting-started',
  '/changelog',
  '/integrations',
  '/customers',
  '/security',
] as const

/**
 * The whole page's data, derived from the four filter fields. `channels` is the multi-select: an
 * EMPTY selection means "every channel", the same convention the `MultiSelectFilter` pill states
 * as `All channels`.
 */
export function buildAnalytics(o: {
  range: AnalyticsRange
  currency: Currency
  compare: CompareMode
  channels: readonly ChannelKey[]
}): Analytics {
  const { count, hourly } = shape(o.range)
  const selected = o.channels.length === 0 ? CHANNEL_KEYS : o.channels
  const share = selected.reduce((total, key) => total + CHANNEL_WEIGHT[key].share, 0)
  const perPoint = (hourly ? 1_850 : 42_000) * share
  const priorFactor = o.compare === 'year' ? 0.71 : 0.88

  const period = deltaPeriodLabel(o.compare)

  const points = series({ count, hourly, base: perPoint, phase: 0.4, priorFactor })
  const total = sum(points.map((point) => point.sales))
  const prior = sum(points.map((point) => point.previous))

  // Every KPI is a ratio of two measured totals, so each delta is that same ratio's change — the
  // orders and AOV series are derived from `points`, which is why they can share one comparison.
  const orders = total / 148
  const priorOrders = prior / 152
  const sessions = orders / 0.041
  const priorSessions = priorOrders / 0.039

  const ordersHistory = points.map((point) => Math.round(point.sales / 148))
  const aovHistory = points.map((_, index) => Math.round(148 * wave(index, 2.6)))
  const conversionHistory = points.map((_, index) => Math.round(410 * wave(index, 1.4)))
  const aov = total / orders
  const priorAov = prior / priorOrders
  const conversion = (orders / sessions) * 100
  const priorConversion = (priorOrders / priorSessions) * 100

  const kpis: Kpi[] = [
    {
      key: 'sales',
      title: 'Total sales',
      value: money(total, o.currency),
      ...deltaOf({ compare: o.compare, current: total, prior }),
      history: points.map((point) => point.sales),
    },
    {
      key: 'orders',
      title: 'Orders',
      value: integer(orders),
      ...deltaOf({ compare: o.compare, current: orders, prior: priorOrders }),
      history: ordersHistory,
    },
    {
      key: 'aov',
      title: 'Average order value',
      value: money(aov, o.currency),
      ...deltaOf({ compare: o.compare, current: aov, prior: priorAov }),
      history: aovHistory,
    },
    {
      key: 'conversion',
      title: 'Conversion rate',
      value: percent(conversion),
      ...deltaOf({ compare: o.compare, current: conversion, prior: priorConversion }),
      history: conversionHistory,
    },
  ]

  const breakdown: BreakdownRow[] = selected.map((key) => {
    const weight = CHANNEL_WEIGHT[key]
    const channelPoints = points.map((point, index) =>
      Math.round(((point.sales * weight.share) / share) * wave(index, weight.phase)),
    )
    return {
      key,
      label: CHANNEL_LABEL[key],
      value: money(sum(channelPoints), o.currency),
      history: channelPoints,
    }
  })

  const funnel: FunnelPoint[] = FUNNEL_STEPS.map((step, index) => ({
    step,
    visitors: Math.round(sessions * FUNNEL_RETENTION[index]!),
  }))

  const topPages: TopPage[] = TOP_PATHS.map((path, index) => ({
    path,
    views: Math.round((sessions / 6) * wave(index, index * 0.9)),
    conversion: Number((2.4 + index * 0.37).toFixed(2)),
    revenue: Math.round((total / 9) * wave(index, index * 0.6)),
  }))

  return {
    points,
    total: money(total, o.currency),
    ...deltaOf({ compare: o.compare, current: total, prior }),
    ...(period !== undefined && { deltaPeriod: period }),
    kpis,
    breakdown,
    funnel,
    retention: series({ count, hourly, base: 68, phase: 1.9, priorFactor }),
    latency: series({ count, hourly, base: 312, phase: 3.4, priorFactor }),
    topPages,
  }
}

/**
 * The `Top pages` table's columns. They live beside the data, not in the page — a column def is a
 * description of a ROW, and `docs/CONTROLS-SPEC.md` §10 imports them from the query module for the
 * same reason. `meta.align` is a closed union (a typo is a tsc error), and every numeric cell states
 * its own formatter rather than relying on the raw number reading well.
 */
const col = createColumnHelper<TopPage>()

export const topPageColumns = [
  col.accessor('path', { header: 'Page' }),
  col.accessor('views', {
    header: 'Views',
    meta: { align: 'right' },
    cell: (info) => integer(info.getValue()),
  }),
  col.accessor('conversion', {
    header: 'Conversion',
    meta: { align: 'right' },
    cell: (info) => `${info.getValue().toFixed(2)}%`,
  }),
  col.accessor('revenue', {
    header: 'Revenue',
    meta: { align: 'right' },
    cell: (info) => integer(info.getValue()),
  }),
]

export { CHANNEL_LABEL, integer, money, percent }
