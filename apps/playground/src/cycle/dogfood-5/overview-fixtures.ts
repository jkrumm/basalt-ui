/**
 * Dogfood cycle 4 (docs/v3/cycles/dogfood-4.md): the console's Overview data in its current shapes
 * (software-factory `2511836a`). Flow became the Overview at `/` and moved to the five work words
 * (`packages/contract/src/work-words.ts`): an open Issue is running, paused, ready, held or
 * checking, and a list may open on what closed lately. The stat cards are `statsOf` (Running,
 * Paused, Not started, Shipped this week) and the trend counts `WORK_TREND_KEYS`
 * (`apps/console/src/lib/flow.ts`). The Issues are cycle 1's, moved onto the new words. Pure data.
 */
import { FLOW_ISSUES, FLOW_NOW } from './flow-fixtures'
import type { FlowIssue } from './flow-fixtures'

export { FLOW_NOW, ORIGIN_LABELS, ORIGINS } from './flow-fixtures'

/** `STATE_KEYS`: the five words, then what closed lately. */
export const WORK_STATES = ['running', 'paused', 'ready', 'held', 'checking', 'closed'] as const
export type WorkState = (typeof WORK_STATES)[number]

/** `LIST_LABEL`. */
export const WORK_LABELS: Record<WorkState, string> = {
  running: 'Running',
  paused: 'Paused',
  ready: 'Ready',
  held: 'Held',
  checking: 'Checking',
  closed: 'Closed recently',
}

export type OverviewIssue = Omit<FlowIssue, 'state'> & { state: WorkState }

/** Cycle 1's Issues under the new words; a reason that named an old word is reworded. */
const MOVED: Record<string, { state: WorkState; reason?: string | null }> = {
  'export-time': { state: 'running' },
  'login-crash': { state: 'paused', reason: 'On you: a Decision on which session store to keep' },
  database: { state: 'held', reason: 'Behind Choose the export format: the chain is not done' },
  'export-queue': { state: 'checking' },
  'host-down': { state: 'held', reason: 'Still being settled' },
  'export-schema': { state: 'closed' },
  runbook: { state: 'running' },
  'old-flags': { state: 'ready', reason: 'Waits for a free seat' },
  'long-title': { state: 'running' },
  'plan-row': { state: 'held', reason: 'Not before Nov 20' },
}

export const OVERVIEW_ISSUES: readonly OverviewIssue[] = FLOW_ISSUES.map((issue) => {
  const moved = MOVED[issue.key] ?? { state: 'held' }
  return {
    ...issue,
    state: moved.state,
    reason: moved.reason === undefined ? issue.reason : moved.reason,
  }
})

/** One stat card as `statsOf` returns it, less the list it opens. */
export type OverviewStat = {
  key: 'running' | 'paused' | 'notStarted' | 'shipped'
  title: string
  subtitle: string
  value: number
  delta: { value: number; higherIsBetter: boolean }
  sub: string
  series?: readonly number[]
  bars?: readonly number[]
  axisLabels: readonly [string, string, string]
  footer: readonly [{ label: string; value: string }, { label: string; value: string }]
  /** The list the card opens; none: the whole list. */
  state: WorkState | undefined
}

const X_LABELS = ['Nov 2', 'Nov 5', 'Now'] as const

export const OVERVIEW_STATS: readonly OverviewStat[] = [
  {
    key: 'running',
    title: 'Running',
    subtitle: 'Issues, vs 7 days ago',
    value: 3,
    delta: { value: 1, higherIsBetter: true },
    sub: 'in 3 projects, 1 more checking',
    series: [2, 3, 3, 4, 5, 4, 4, 3],
    axisLabels: X_LABELS,
    footer: [
      { label: 'Oldest', value: '4 h' },
      { label: 'Queue', value: 'Open' },
    ],
    state: 'running',
  },
  {
    key: 'paused',
    title: 'Paused',
    subtitle: 'Issues, vs 7 days ago',
    value: 1,
    delta: { value: -3, higherIsBetter: false },
    sub: 'on you 1',
    series: [4, 5, 5, 4, 3, 2, 2, 1],
    axisLabels: X_LABELS,
    footer: [
      { label: 'Oldest', value: '3 h' },
      { label: 'Projects', value: '1' },
    ],
    state: 'paused',
  },
  {
    key: 'notStarted',
    title: 'Not started',
    subtitle: 'Issues, vs 7 days ago',
    value: 4,
    delta: { value: 0, higherIsBetter: false },
    sub: '1 ready, 3 held',
    series: [4, 6, 5, 7, 6, 5, 5, 4],
    axisLabels: X_LABELS,
    footer: [
      { label: 'Oldest', value: '30 min' },
      { label: 'Projects', value: '3' },
    ],
    state: undefined,
  },
  {
    key: 'shipped',
    title: 'Shipped this week',
    subtitle: 'vs prior week, all projects',
    value: 12,
    delta: { value: 4, higherIsBetter: true },
    sub: '8 in the 7 days before',
    bars: [1, 1, 0, 2, 1, 3, 4],
    axisLabels: X_LABELS,
    footer: [
      { label: 'Best day', value: '4' },
      { label: 'Last day', value: '4' },
    ],
    state: 'closed',
  },
]

/** `docs/language.md`'s definitions, which the console's `InfoHint` shows for each word. */
export const DEFINITIONS: Record<OverviewStat['key'] | 'checking', string> = {
  running:
    'A lead works on it now: the Issue is in the working state and holds a seat. The count is of Issues, not sessions.',
  paused:
    'A lead began it and it waits on a named wait, no session running: on you, on a timer, on another Issue, or stalled.',
  notStarted: 'The Issues no lead has begun: Ready and Held. The trend shows them as one line.',
  checking:
    'Shipped and deployed: the watch is on, the factory runs Verify and the probes, and the Issue closes when they pass.',
  shipped:
    'How many Issues closed done in the last 7 days across all projects, against the 7 days before.',
}

/** `WORK_TREND_KEYS` and the chart's `COUNT_LABEL`. */
export const TREND_COUNTS = ['running', 'paused', 'notStarted', 'checking'] as const
export type TrendCount = (typeof TREND_COUNTS)[number]

export const COUNT_LABELS: Record<TrendCount, string> = {
  running: 'Running',
  paused: 'Paused',
  notStarted: 'Not started',
  checking: 'Checking',
}

/** `TREND_RANGES`: 24 hours and 7 days by the hour, 30 days by the day. */
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
const LEVEL: Record<TrendCount, number> = { running: 4, paused: 2, notStarted: 5, checking: 1 }

export type TrendBucket = { at: Date; peak: number; avg: number }

/** `trendLines`: one count over one window, the peak and the average in each bucket. */
export function trendOf(count: TrendCount, window: TrendWindow): TrendBucket[] {
  const { buckets, step } = SHAPE[window]
  const level = LEVEL[count]
  return Array.from({ length: buckets }, (_, i) => {
    const wave = Math.sin((i / (step === DAY ? 7 : 24)) * 2 * Math.PI + level)
    const peak = Math.max(0, Math.round(level + 2 * wave + 0.6 * Math.sin(i * 1.7)))
    const avg = Math.round(Math.max(0, peak * 0.6 + wave * 0.4) * 10) / 10
    return { at: new Date(FLOW_NOW - (buckets - 1 - i) * step), peak, avg: Math.min(avg, peak) }
  })
}
