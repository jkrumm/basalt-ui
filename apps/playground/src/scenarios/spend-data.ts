/**
 * S4 fixture data: ~90 days of daily spend in EUR across six projects and three models, shaped like
 * argo's usage-tracking. Deterministic — a seeded generator run once at module load, so a
 * re-render, a reload and a screenshot all read the same numbers.
 */

export const PROJECT_KEYS = [
  'search',
  'support',
  'summaries',
  'ingest',
  'evals',
  'sandbox',
] as const
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
const WINDOW_DAYS = 90

export const MONTH_LABEL = 'October 2026'
export const MONTH_DAYS = 31
export const DAYS_ELAPSED = TODAY.getUTCDate()
export const BUDGET_EUR = 1500

/** € per day per project and model at weight 1 — the scale the generator multiplies. */
const BASE_EUR: Record<ProjectKey, Record<ModelKey, number>> = {
  search: { large: 9, mid: 6, small: 3 },
  support: { large: 4, mid: 7, small: 5 },
  summaries: { large: 2, mid: 5, small: 4 },
  ingest: { large: 0, mid: 3, small: 6 },
  evals: { large: 6, mid: 2, small: 1 },
  sandbox: { large: 1, mid: 1, small: 1 },
}

/** mulberry32 — a 32-bit seeded generator, the smallest one with a flat enough spread for noise. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type DayRow = {
  date: Date
  large: number
  mid: number
  small: number
  total: number
}

type ProjectDay = Record<ProjectKey, number>

const random = seeded(2026_10_16)

const dayStart = TODAY.getTime() - (WINDOW_DAYS - 1) * 86_400_000

const raw = Array.from({ length: WINDOW_DAYS }, (_, i) => {
  const date = new Date(dayStart + i * 86_400_000)
  const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6
  // A slow climb (+0.5 % a day) and a weekend dip; Evals bursts on the 1st and 15th of a month.
  const level = (weekend ? 0.55 : 1) * (1 + i * 0.005)
  const byProject = {} as ProjectDay
  const byModel: Record<ModelKey, number> = { large: 0, mid: 0, small: 0 }
  for (const project of PROJECT_KEYS) {
    const burst = project === 'evals' && [1, 15].includes(date.getUTCDate()) ? 3.2 : 1
    let projectTotal = 0
    for (const model of MODEL_KEYS) {
      const spend = BASE_EUR[project][model] * level * burst * (0.8 + random() * 0.4)
      byModel[model] += spend
      projectTotal += spend
    }
    byProject[project] = projectTotal
  }
  return { date, byProject, byModel }
})

export const DAILY: readonly DayRow[] = raw.map(({ date, byModel }) => ({
  date,
  ...byModel,
  total: byModel.large + byModel.mid + byModel.small,
}))

const sum = (values: readonly number[]): number => values.reduce((a, b) => a + b, 0)
const inMonth = (date: Date, month: number): boolean =>
  date.getUTCMonth() === month && date.getUTCDate() <= DAYS_ELAPSED

const MONTH = TODAY.getUTCMonth()
const mtdIndexes = raw.flatMap((r, i) => (inMonth(r.date, MONTH) ? [i] : []))
const priorIndexes = raw.flatMap((r, i) => (inMonth(r.date, MONTH - 1) ? [i] : []))

export const MTD_EUR = sum(mtdIndexes.map((i) => DAILY[i]?.total ?? 0))
export const PRIOR_MTD_EUR = sum(priorIndexes.map((i) => DAILY[i]?.total ?? 0))

/** Naive end-of-month forecast: the month-to-date daily average held flat to the last day. */
export const FORECAST_EUR = (MTD_EUR / DAYS_ELAPSED) * MONTH_DAYS

/** The last 30 days of total spend, oldest first — the StatCard trend. */
export const LAST_30_TOTALS: readonly number[] = DAILY.slice(-30).map((d) => d.total)

export type ProjectRow = {
  key: ProjectKey
  label: string
  spend: number
  /** Share of the month-to-date total, 0..1. */
  share: number
  /** Change against the same days of the prior month, as a fraction. */
  change: number
}

const projectSpend = (indexes: readonly number[], key: ProjectKey): number =>
  sum(indexes.map((i) => raw[i]?.byProject[key] ?? 0))

export const PROJECTS_MTD: readonly ProjectRow[] = PROJECT_KEYS.map((key) => {
  const spend = projectSpend(mtdIndexes, key)
  const prior = projectSpend(priorIndexes, key)
  return {
    key,
    label: PROJECT_LABEL[key],
    spend,
    share: spend / MTD_EUR,
    change: spend / prior - 1,
  }
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

export const fmtEur = (value: number): string => EUR.format(Math.round(value))
export const fmtShare = (value: number): string => `${Math.round(value * 100)} %`
