/**
 * The data the dashboard draws: the public CBBI daily data (price, confidence and nine metrics since
 * 2011), committed as `cbbi.snapshot.json` and read through a query like any live source, so a
 * live endpoint replaces it with no change to the page. `scripts/cbbi-snapshot.ts` regenerates it.
 */
import { queryOptions } from '@tanstack/react-query'
import type { Verdict } from 'basalt-ui/cards'
import { liveQuery } from 'basalt-ui/data'

export const METRICS = [
  {
    key: 'piCycle',
    label: 'Pi Cycle Top',
    about: 'The 111-day average against twice the 350-day one: the two meet at cycle tops.',
  },
  {
    key: 'rupl',
    label: 'RUPL/NUPL',
    about:
      'The share of the market value held as unrealized profit: high means holders sit on large gains.',
  },
  {
    key: 'rhodl',
    label: 'RHODL Ratio',
    about:
      'Realized value of week-old coins against one-to-two-year-old coins: high means young coins dominate.',
  },
  {
    key: 'puell',
    label: 'Puell Multiple',
    about:
      'The value of daily miner issuance against its one-year average: high means miners earn far above normal.',
  },
  {
    key: 'ma2y',
    label: '2 Year MA',
    about:
      'The price against its two-year moving average and a multiple of it: high means far above trend.',
  },
  {
    key: 'trolololo',
    label: 'Bitcoin Trolololo',
    about:
      'The price against the long-run logarithmic trend band: high means near the top of the band.',
  },
  {
    key: 'mvrv',
    label: 'MVRV Z-Score',
    about:
      'The market value against the realized value as a Z-score: high means holders are far in profit.',
  },
  {
    key: 'reserveRisk',
    label: 'Reserve Risk',
    about:
      'Long-term holder conviction against price: high means little conviction at a high price.',
  },
  {
    key: 'woobull',
    label: 'Woobull Top Cap',
    about:
      'The price against the Top Cap, a running average of the price: high means near the top.',
  },
] as const

export type MetricKey = (typeof METRICS)[number]['key']

/** The metrics drawn until a reader picks others. */
export const DEFAULT_METRICS: readonly MetricKey[] = ['rupl', 'rhodl', 'puell', 'ma2y', 'mvrv']

export type Snapshot = {
  /** The first reading's day, `YYYY-MM-DD`. */
  start: string
  stepDays: number
  price: readonly number[]
  /** Per metric, in thousandths: the plain reading and the diminishing-returns one. */
  metrics: Readonly<
    Record<MetricKey, { plain: readonly (number | null)[]; dr: readonly (number | null)[] }>
  >
}

export const NO_SNAPSHOT: Snapshot = {
  start: '2011-06-28',
  stepDays: 3,
  price: [],
  metrics: Object.fromEntries(
    METRICS.map(({ key }) => [key, { plain: [], dr: [] }]),
  ) as unknown as Snapshot['metrics'],
}

/** The snapshot is a lazy chunk, so the page's route stays small and the read has a loading phase. */
export const cbbiQuery = liveQuery(
  queryOptions({
    queryKey: ['dashboard', 'cbbi'],
    queryFn: async (): Promise<Snapshot> => (await import('./cbbi.snapshot.json')).default,
  }),
  'static',
)

const DAY_MS = 86_400_000

/** One reading: the close and each metric on the index's 0 to 100 scale, a diminishing-returns reading clamped to it. */
export type Day = {
  t: Date
  price: number
  /** The confidence, the mean of the selected metrics. */
  score: number | null
  metrics: Readonly<Record<MetricKey, number | null>>
}

const clamp = (v: number): number => Math.min(100, Math.max(0, v))

export function buildDays(
  snapshot: Snapshot,
  { selected, diminishing }: { selected: readonly MetricKey[]; diminishing: boolean },
): Day[] {
  const first = Date.parse(snapshot.start)
  const variant = diminishing ? 'dr' : 'plain'
  return snapshot.price.map((price, i) => {
    const metrics = Object.fromEntries(
      METRICS.map(({ key }) => {
        const v = snapshot.metrics[key][variant][i]
        return [key, v === null || v === undefined ? null : clamp(v / 10)]
      }),
    ) as Record<MetricKey, number | null>
    const read = selected.flatMap((key) => {
      const v = snapshot.metrics[key][variant][i]
      return v === null || v === undefined ? [] : [v / 10]
    })
    return {
      t: new Date(first + i * snapshot.stepDays * DAY_MS),
      price,
      score: read.length === 0 ? null : clamp(read.reduce((sum, v) => sum + v, 0) / read.length),
      metrics,
    }
  })
}

/** The score at or past which the index calls a top, and at or under which a bottom. */
export const TOP = 80
export const BOTTOM = 20

export function verdictOf(score: number): Verdict {
  if (score >= TOP) return { tone: 'bad', label: 'Near a top' }
  if (score <= BOTTOM) return { tone: 'good', label: 'Near a bottom' }
  return { tone: 'neutral', label: 'Mid-cycle' }
}

/** The halvings the history crosses: the block reward halves, each an event on the time axis. */
export const HALVINGS = [
  { at: new Date(Date.UTC(2012, 10, 28)), label: 'Halving', note: '50 to 25 BTC' },
  { at: new Date(Date.UTC(2016, 6, 9)), label: 'Halving', note: '25 to 12.5 BTC' },
  { at: new Date(Date.UTC(2020, 4, 11)), label: 'Halving', note: '12.5 to 6.25 BTC' },
  { at: new Date(Date.UTC(2024, 3, 20)), label: 'Halving', note: '6.25 to 3.125 BTC' },
] as const

/** One cycle: the lowest close in the two years before a halving to the highest in the two years after. */
export type Cycle = {
  id: string
  /** The halving it runs around, `2016 halving`. */
  label: string
  from: Date
  to: Date
  bottom: number
  top: number
  multiple: number
  days: number
}

const TWO_YEARS_MS = 730 * DAY_MS

export function cyclesOf(days: readonly Day[]): Cycle[] {
  return HALVINGS.flatMap(({ at }) => {
    const before = days.filter((d) => d.t <= at && d.t.getTime() >= at.getTime() - TWO_YEARS_MS)
    const after = days.filter((d) => d.t >= at && d.t.getTime() <= at.getTime() + TWO_YEARS_MS)
    const low = before.reduce<Day | undefined>(
      (m, d) => (m && m.price <= d.price ? m : d),
      undefined,
    )
    const high = after.reduce<Day | undefined>(
      (m, d) => (m && m.price >= d.price ? m : d),
      undefined,
    )
    if (low === undefined || high === undefined || high.t <= low.t) return []
    return [
      {
        id: String(at.getUTCFullYear()),
        label: `${at.getUTCFullYear()} halving`,
        from: low.t,
        to: high.t,
        bottom: low.price,
        top: high.price,
        multiple: high.price / low.price,
        days: Math.round((high.t.getTime() - low.t.getTime()) / DAY_MS),
      },
    ]
  })
}
