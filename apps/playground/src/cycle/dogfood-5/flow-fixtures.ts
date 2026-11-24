/**
 * Dogfood cycle 1 (docs/v3/cycles/dogfood-1.md): the factory console's overview data, in the
 * console's own shapes. The stat cards are `KIT_STATS`, the Issues `KIT_ISSUES` with
 * `KIT_ORIGIN` (software-factory `apps/console/src/components/kit/fixtures.ts`), and the in-flight
 * trend is the Flow page's `trend.states` (`apps/console/src/lib/flow.ts`). Pure data, no I/O.
 */

/** The clock every age is read against: the console's `KIT_NOW`. */
export const FLOW_NOW = Date.parse('2026-11-09T12:00:00Z')

const ago = (minutes: number): string => new Date(FLOW_NOW - minutes * 60_000).toISOString()

export const FLOW_STATES = ['settling', 'queued', 'working', 'waiting', 'watching', 'done'] as const
export type FlowState = (typeof FLOW_STATES)[number]

export const STATE_LABELS: Record<FlowState, string> = {
  settling: 'Settling',
  queued: 'Queued',
  working: 'Working',
  waiting: 'Waiting',
  watching: 'Watching',
  done: 'Done',
}

export const PROJECTS = ['argo', 'orion', 'pearl'] as const
export type Project = (typeof PROJECTS)[number]

export const ORIGINS = [
  'you',
  'application',
  'github',
  'infrastructure',
  'factory',
  'feedback',
] as const
export type Origin = (typeof ORIGINS)[number]

export const ORIGIN_LABELS: Record<Origin, string> = {
  you: 'You',
  application: 'Application',
  github: 'GitHub',
  infrastructure: 'Infrastructure',
  factory: 'Factory',
  feedback: 'Feedback',
}

const KINDS = ['feature', 'bug', 'chore', 'docs', 'incident'] as const
export type Kind = (typeof KINDS)[number]

export type FlowIssue = {
  key: string
  /** The Issue's number; null for a plan row. */
  number: number | null
  title: string
  project: Project
  origin: Origin
  kind: Kind
  state: FlowState
  reason: string | null
  /** ISO time it entered its state; null for a plan row. */
  since: string | null
}

export const FLOW_ISSUES: readonly FlowIssue[] = [
  {
    key: 'export-time',
    number: 657,
    title: 'Show the export time on the board',
    project: 'pearl',
    origin: 'you',
    kind: 'feature',
    state: 'working',
    reason: null,
    since: ago(42),
  },
  {
    key: 'login-crash',
    number: 642,
    title: 'The login page crashes on submit',
    project: 'argo',
    origin: 'application',
    kind: 'bug',
    state: 'waiting',
    reason: 'Waiting for the answer to a Decision: which session store to keep',
    since: ago(190),
  },
  {
    key: 'database',
    number: 618,
    title: 'Pick a database',
    project: 'argo',
    origin: 'you',
    kind: 'chore',
    state: 'queued',
    reason: 'Queued behind Choose the export format: the chain is not done',
    since: ago(7),
  },
  {
    key: 'export-queue',
    number: 631,
    title: 'Move the export job to the new queue',
    project: 'orion',
    origin: 'github',
    kind: 'feature',
    state: 'watching',
    reason: null,
    since: ago(1500),
  },
  {
    key: 'host-down',
    number: 660,
    title: 'The host stopped answering and three alerts fired',
    project: 'orion',
    origin: 'infrastructure',
    kind: 'incident',
    state: 'settling',
    reason: null,
    since: ago(0.4),
  },
  {
    key: 'export-schema',
    number: 604,
    title: 'Publish the export schema',
    project: 'pearl',
    origin: 'factory',
    kind: 'docs',
    state: 'done',
    reason: 'Shipped and verified on the host',
    since: ago(4300),
  },
  {
    key: 'runbook',
    number: 649,
    title: 'Write the restore runbook for the export store',
    project: 'argo',
    origin: 'feedback',
    kind: 'docs',
    state: 'working',
    reason: null,
    since: ago(95),
  },
  {
    key: 'old-flags',
    number: 622,
    title: 'Remove the feature flags that shipped last quarter',
    project: 'orion',
    origin: 'you',
    kind: 'chore',
    state: 'queued',
    reason: 'Queued behind Move the export job to the new queue: the chain is not done',
    since: ago(30),
  },
  {
    key: 'long-title',
    number: 1042,
    title:
      'Make the export job resumable after a host restart, keep the partial files it already wrote, and report which rows were skipped when the same job is started again on the next scheduled run',
    project: 'orion',
    origin: 'you',
    kind: 'bug',
    state: 'working',
    reason:
      'Waiting for the export store to finish its nightly compaction before the next batch may start',
    since: ago(260),
  },
  {
    key: 'plan-row',
    number: null,
    title: 'Add the archive step to the export plan',
    project: 'pearl',
    origin: 'you',
    kind: 'feature',
    state: 'queued',
    reason: 'Not before Nov 20',
    since: null,
  },
]

/** One stat card, as `KIT_STATS` holds it (the console's `StatCardProps` less the icon). */
export type FlowStat = {
  key: 'working' | 'waiting' | 'queued' | 'shipped'
  title: string
  subtitle: string
  value: number
  delta: { value: number; higherIsBetter: boolean }
  sub: string
  /** A line, or bars; the console's Working line runs into the future from `futureFrom`. */
  series?: {
    values: readonly number[]
    labels: readonly string[]
    futureFrom?: number
    target?: number
  }
  bars?: { values: readonly number[]; labels: readonly string[] }
  axisLabels: readonly [string, string, string]
  footer: readonly [{ label: string; value: string }, { label: string; value: string }]
}

export const FLOW_STATS: readonly FlowStat[] = [
  {
    key: 'working',
    title: 'Working',
    subtitle: 'Against the target of 6 leads',
    value: 4,
    delta: { value: 1, higherIsBetter: true },
    sub: 'Leads running right now',
    series: {
      values: [2, 3, 3, 4, 5, 4, 4, 5, 4],
      labels: [
        'Mon 00:00',
        'Mon 12:00',
        'Tue 00:00',
        'Tue 12:00',
        'Wed 00:00',
        'Wed 12:00',
        'Thu 00:00',
        'Thu 12:00',
        'Fri 00:00',
      ],
      futureFrom: 7,
      target: 6,
    },
    axisLabels: ['Mon', 'Now', 'Sun'],
    footer: [
      { label: 'Peak', value: '5 leads' },
      { label: 'Idle slots', value: '2' },
    ],
  },
  {
    key: 'waiting',
    title: 'Waiting',
    subtitle: 'Against the last 7 days',
    value: 3,
    delta: { value: -2, higherIsBetter: false },
    sub: 'Two need you, one waits for a time',
    series: {
      values: [6, 5, 5, 4, 5, 4, 3],
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    axisLabels: ['Mon', 'Thu', 'Sun'],
    footer: [
      { label: 'Oldest', value: '3 h ago' },
      { label: 'On a person', value: '2' },
    ],
  },
  {
    key: 'queued',
    title: 'Queued',
    subtitle: 'Per day, last 7 days',
    value: 7,
    delta: { value: 0, higherIsBetter: false },
    sub: 'Held back by the chain and the weekly pace',
    bars: {
      values: [3, 5, 4, 8, 6, 9, 7],
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    },
    axisLabels: ['Mon', 'Thu', 'Today'],
    footer: [
      { label: 'By the chain', value: '4' },
      { label: 'By the pace', value: '3' },
    ],
  },
  {
    key: 'shipped',
    title: 'Shipped this week',
    subtitle: 'Against the week before',
    value: 12,
    delta: { value: 4, higherIsBetter: true },
    sub: 'Issues closed as done',
    series: {
      values: [1, 2, 2, 4, 5, 7, 9, 12],
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Now'],
    },
    axisLabels: ['Mon', 'Thu', 'Now'],
    footer: [
      { label: 'Per day', value: '1.7' },
      { label: 'Healed', value: '2' },
    ],
  },
]

/** Issues in each state per day, the last 14 days: the Flow page's `trend.states`. */
export type TrendDay = { day: Date; working: number; waiting: number; queued: number }

export const FLOW_TREND: readonly TrendDay[] = Array.from({ length: 14 }, (_, i) => ({
  day: new Date(Date.UTC(2026, 9, 27 + i)),
  working: [2, 3, 3, 4, 5, 4, 4, 5, 4, 3, 4, 5, 5, 4][i] ?? 0,
  waiting: [6, 5, 5, 4, 5, 4, 3, 4, 5, 4, 3, 3, 4, 3][i] ?? 0,
  queued: [3, 5, 4, 8, 6, 9, 7, 6, 8, 7, 9, 8, 6, 7][i] ?? 0,
}))
