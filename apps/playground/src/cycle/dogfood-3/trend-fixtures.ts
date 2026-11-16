/**
 * Dogfood cycle 3 (docs/v3/cycles/dogfood-3.md): the Flow page's "Issues over time" data in the
 * console's shape (`FlowTrendSeries` read through `trendLines`, software-factory
 * `apps/console/src/lib/flow.ts`): per bucket, the peak and the average of one count. 24 hours and
 * 7 days are plotted by the hour, 30 days by the day. Generated from a fixed clock, pure data.
 */
import { FLOW_NOW } from '../dogfood-1/flow-fixtures'

export const TREND_COUNTS = ['working', 'waiting', 'queued'] as const
export type TrendCount = (typeof TREND_COUNTS)[number]

export const COUNT_LABELS: Record<TrendCount, string> = {
  working: 'Working',
  waiting: 'Waiting',
  queued: 'Queued',
}

/** The console's `docs/language.md` definitions, the text of its InfoHint on each card. */
export const COUNT_DEFINITIONS: Record<TrendCount, string> = {
  working:
    'An Issue a lead is running now, the watching ones included; it counts Issues, not sessions.',
  waiting:
    "An Issue a lead started and that is paused on a named wait: a timer, the owner's review or a blocker; it counts Issues, not sessions.",
  queued:
    'An Issue that is ready and that no lead has started, held back by capacity or a chain; it counts Issues, not sessions.',
}

export const TREND_WINDOWS = ['24h', '7d', '30d'] as const
export type TrendWindow = (typeof TREND_WINDOWS)[number]

export const WINDOW_LABELS: Record<TrendWindow, string> = {
  '24h': '24 h',
  '7d': '7 d',
  '30d': '30 d',
}

const HOUR = 3_600_000
const DAY = 24 * HOUR
const SHAPE: Record<TrendWindow, { buckets: number; step: number }> = {
  '24h': { buckets: 24, step: HOUR },
  '7d': { buckets: 168, step: HOUR },
  '30d': { buckets: 30, step: DAY },
}
const LEVEL: Record<TrendCount, number> = { working: 4, waiting: 3, queued: 6 }

export type TrendBucket = { at: Date; peak: number; avg: number }

/** One count over one window: the bucket starts with the peak and the average in each. */
export function trendOf(count: TrendCount, window: TrendWindow): TrendBucket[] {
  const { buckets, step } = SHAPE[window]
  const level = LEVEL[count]
  return Array.from({ length: buckets }, (_, i) => {
    // a daily rhythm by the hour, a weekly one by the day, and a little jitter
    const wave = Math.sin((i / (step === DAY ? 7 : 24)) * 2 * Math.PI + level)
    const peak = Math.max(0, Math.round(level + 2 * wave + 0.6 * Math.sin(i * 1.7)))
    const avg = Math.round(Math.max(0, peak * 0.6 + wave * 0.4) * 10) / 10
    return { at: new Date(FLOW_NOW - (buckets - 1 - i) * step), peak, avg: Math.min(avg, peak) }
  })
}
