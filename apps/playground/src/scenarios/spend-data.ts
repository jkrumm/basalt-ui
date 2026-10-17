/**
 * S4 fixture data: ~90 days of daily spend in EUR across six projects and three models, shaped like
 * argo's usage-tracking. Deterministic — a seeded generator run once at module load, so a
 * re-render, a reload and a screenshot all read the same numbers. Every period label is derived
 * from `TODAY`, so moving the reading date moves the copy with it.
 */

import { seeded } from './fixture-utils'

const PROJECT_KEYS = ['search', 'support', 'summaries', 'ingest', 'evals', 'sandbox'] as const
export type ProjectKey = (typeof PROJECT_KEYS)[number]

export const MODEL_KEYS = ['large', 'mid', 'small'] as const
export type ModelKey = (typeof MODEL_KEYS)[number]

export const PROJECT_LABEL: Record<ProjectKey, string> = {
  search: 'Search',
  support: 'Support bot',
  summaries: 'Summaries',
  ingest: 'Ingest',
  evals: 'Evals',
  sandbox: 'Sandbox',
}

export const MODEL_LABEL: Record<ModelKey, string> = {
  large: 'Large model',
  mid: 'Mid model',
  small: 'Small model',
}

/** The reading date. Fixed, so the month-to-date window never moves under a screenshot. */
const TODAY = new Date(Date.UTC(2026, 9, 16))
const DAY_MS = 86_400_000
const WINDOW_DAYS = 90

export const YEAR = TODAY.getUTCFullYear()
const month = TODAY.getUTCMonth()
const priorMonthStart = new Date(Date.UTC(YEAR, month - 1, 1))

const monthName = (date: Date, style: 'long' | 'short'): string =>
  date.toLocaleDateString('en-GB', { month: style, timeZone: 'UTC' })

export const DAYS_ELAPSED = TODAY.getUTCDate()
export const MONTH_DAYS = new Date(Date.UTC(YEAR, month + 1, 0)).getUTCDate()
export const BUDGET_EUR = 1500

export const MONTH_NAME = monthName(TODAY, 'long')
export const MONTH_LABEL = `${MONTH_NAME} ${YEAR}`
/** `1–16 Oct` — the month-to-date window, and `1–16 Sep` the same days a month earlier. */
export const WINDOW_LABEL = `1–${DAYS_ELAPSED} ${monthName(TODAY, 'short')}`
export const PRIOR_WINDOW_LABEL = `1–${DAYS_ELAPSED} ${monthName(priorMonthStart, 'short')}`

/** € per day per project and model at weight 1 — the scale the generator multiplies. */
const BASE_EUR: Record<ProjectKey, Record<ModelKey, number>> = {
  search: { large: 9, mid: 6, small: 3 },
  support: { large: 4, mid: 7, small: 5 },
  summaries: { large: 2, mid: 5, small: 4 },
  ingest: { large: 0, mid: 3, small: 6 },
  evals: { large: 6, mid: 2, small: 1 },
  sandbox: { large: 1, mid: 1, small: 1 },
}

type Entry = { project: ProjectKey; model: ModelKey; eur: number }
type RawDay = { date: Date; entries: Entry[] }

const random = seeded(2026_10_16)
const windowStart = TODAY.getTime() - (WINDOW_DAYS - 1) * DAY_MS

const RAW: readonly RawDay[] = Array.from({ length: WINDOW_DAYS }, (_, i) => {
  const date = new Date(windowStart + i * DAY_MS)
  const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6
  // A slow climb (+0.5 % a day) and a weekend dip; Evals bursts on the 1st and 15th of a month.
  const level = (weekend ? 0.55 : 1) * (1 + i * 0.005)
  const entries = PROJECT_KEYS.flatMap((project) => {
    const burst = project === 'evals' && [1, 15].includes(date.getUTCDate()) ? 3.2 : 1
    return MODEL_KEYS.map((model) => ({
      project,
      model,
      eur: BASE_EUR[project][model] * level * burst * (0.8 + random() * 0.4),
    }))
  })
  return { date, entries }
})

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)
const eurOf = (entries: readonly Entry[], match: (e: Entry) => boolean): number =>
  sum(entries.filter(match).map((e) => e.eur))

export type DayRow = { date: Date; large: number; mid: number; small: number; total: number }

export const DAILY: readonly DayRow[] = RAW.map(({ date, entries }) => ({
  date,
  large: eurOf(entries, (e) => e.model === 'large'),
  mid: eurOf(entries, (e) => e.model === 'mid'),
  small: eurOf(entries, (e) => e.model === 'small'),
  total: eurOf(entries, () => true),
}))

const monthToDate = (monthStart: Date): RawDay[] =>
  RAW.filter(
    ({ date }) =>
      date.getUTCFullYear() === monthStart.getUTCFullYear() &&
      date.getUTCMonth() === monthStart.getUTCMonth() &&
      date.getUTCDate() <= DAYS_ELAPSED,
  )

const MTD_RAW = monthToDate(TODAY)
const PRIOR_MTD_RAW = monthToDate(priorMonthStart)
const MTD_ENTRIES = MTD_RAW.flatMap((d) => d.entries)
const PRIOR_MTD_ENTRIES = PRIOR_MTD_RAW.flatMap((d) => d.entries)

export const MTD_EUR = eurOf(MTD_ENTRIES, () => true)
export const PRIOR_MTD_EUR = eurOf(PRIOR_MTD_ENTRIES, () => true)

/** The month-to-date change against the same days of the prior month, in percent: the ratio of the
 * two totals, which is the spend-weighted combination of the per-project changes, so it cannot
 * disagree with the drivers table. */
export const MTD_CHANGE_PCT = (MTD_EUR / PRIOR_MTD_EUR - 1) * 100

/** Naive end-of-month forecast: the month-to-date daily average held flat to the last day. */
export const FORECAST_EUR = (MTD_EUR / DAYS_ELAPSED) * MONTH_DAYS

/** The month-to-date days, oldest first. */
export const MTD_DAYS: readonly DayRow[] = DAILY.filter((d) =>
  MTD_RAW.some((r) => r.date.getTime() === d.date.getTime()),
)
export const MTD_TOTALS: readonly number[] = MTD_DAYS.map((d) => d.total)

type Part = { label: string; spend: number; /** 0..1 of the month-to-date total. */ share: number }

export type ProjectRow = Part & {
  key: ProjectKey
  /** Change against the same days of the prior month, as a fraction. */
  change: number
}

export const PROJECTS_MTD: readonly ProjectRow[] = PROJECT_KEYS.map((key) => {
  const spend = eurOf(MTD_ENTRIES, (e) => e.project === key)
  const prior = eurOf(PRIOR_MTD_ENTRIES, (e) => e.project === key)
  return {
    key,
    label: PROJECT_LABEL[key],
    spend,
    share: spend / MTD_EUR,
    change: spend / prior - 1,
  }
}).toSorted((a, b) => b.spend - a.spend)

export const MODELS_MTD: readonly (Part & { key: ModelKey })[] = MODEL_KEYS.map((key) => {
  const spend = eurOf(MTD_ENTRIES, (e) => e.model === key)
  return { key, label: MODEL_LABEL[key], spend, share: spend / MTD_EUR }
}).toSorted((a, b) => b.spend - a.spend)

export type DistributionBin = { from: number; label: string; days: number }

const BIN_WIDTH_EUR = 10

/** Days by total spend, in €10 bins — the shape of a typical day and how heavy the tail is. */
export const DISTRIBUTION: readonly DistributionBin[] = (() => {
  const totals = DAILY.map((d) => d.total)
  const first = Math.floor(Math.min(...totals) / BIN_WIDTH_EUR) * BIN_WIDTH_EUR
  const last = Math.floor(Math.max(...totals) / BIN_WIDTH_EUR) * BIN_WIDTH_EUR
  const bins: DistributionBin[] = []
  for (let from = first; from <= last; from += BIN_WIDTH_EUR) {
    bins.push({
      from,
      label: `€${from}`,
      days: totals.filter((t) => t >= from && t < from + BIN_WIDTH_EUR).length,
    })
  }
  return bins
})()

const EUR = new Intl.NumberFormat('en-IE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
})

/** A spend bin as the band it covers: "€40–50". */
export const spendBand = (bin: DistributionBin): string =>
  `€${bin.from}–${bin.from + BIN_WIDTH_EUR}`

export const fmtEur = (value: number): string => EUR.format(Math.round(value))
export const fmtShare = (value: number): string => `${Math.round(value * 100)}%`
export const fmtSignedShare = (value: number): string => {
  const percent = Math.round(value * 100)
  return percent < 0 ? `\u2212${-percent}%` : `+${percent}%`
}
