/**
 * S3 fixture data: the agent work queue, shaped like argo's warden and agents pages. Hand-authored
 * and deterministic — a screenshot and a reload read the same numbers. Ages are hours before the
 * reading date `TODAY`; every derived figure the page states is computed here so it cannot drift
 * from the list it summarises.
 */

import type { ChartSeries } from 'basalt-ui/charts'
import { VX } from 'basalt-ui/tokens'
import { demoColors } from '../demo/series'
import { fmtDay, fmtInt, timedPoints } from './fixture-utils'

/** The reading date. Fixed, so the 14-day windows never move under a screenshot. */
export const TODAY = new Date(Date.UTC(2026, 9, 16))
const DAY_MS = 86_400_000
export const TODAY_LABEL = fmtDay(TODAY)

export const ITEM_STATES = ['awaiting', 'running', 'queued', 'blocked'] as const
export type ItemState = (typeof ITEM_STATES)[number]

/** Status word per state; the page pairs it with a dot, never colour alone. */
export const STATE_LABEL: Record<ItemState, string> = {
  awaiting: 'Awaiting',
  running: 'Running',
  queued: 'Queued',
  blocked: 'Blocked',
}

export type Item = {
  id: string
  title: string
  state: ItemState
  /** Hours the item has waited in its current state. */
  waitHours: number
  /** Why a blocked item cannot move. */
  reason?: string
}

/** A wait past this raises a warning; past `ABANDON_HOURS` warden closes the item as abandoned. */
export const WARN_HOURS = 24
export const ABANDON_HOURS = 168

const item = (
  id: string,
  state: ItemState,
  waitHours: number,
  title: string,
  reason?: string,
): Item => ({
  id,
  title,
  state,
  waitHours,
  ...(reason !== undefined && { reason }),
})

export const ITEMS: readonly Item[] = [
  item('w-412', 'awaiting', 71, 'Drop the session table'),
  item('w-418', 'awaiting', 49, 'Replace polling hook'),
  item('w-421', 'awaiting', 30, 'Raise queue concurrency'),
  item('w-427', 'awaiting', 19, 'Rotate the deploy token'),
  item('w-431', 'awaiting', 7, 'Rate-limit the export'),
  item('w-433', 'awaiting', 3, 'Move settings page'),
  item('w-425', 'running', 2, 'Backfill the usage ledger'),
  item('w-429', 'running', 5, 'Split the billing module'),
  item('w-430', 'running', 1, 'Fix the chart legend overflow'),
  item('w-432', 'running', 4, 'Pin the base image digest'),
  item('w-434', 'queued', 6, 'Retry failed webhooks with backoff'),
  item('w-435', 'queued', 4, 'Document the pagination cursor'),
  item('w-436', 'queued', 3, 'Add an empty state to the run list'),
  item('w-437', 'queued', 2, 'Prune stale preview environments'),
  item('w-438', 'queued', 2, 'Cache the project lookup'),
  item('w-439', 'queued', 1, 'Log the job id on every retry'),
  item('w-422', 'blocked', 52, 'Upgrade the router major', 'API change'),
  item('w-424', 'blocked', 28, 'Migrate the audit log', 'Failing check'),
  item('w-428', 'blocked', 14, 'Staging autoscaler', 'Infra quota'),
]

const awaiting = ITEMS.filter((i) => i.state === 'awaiting')
export const NEEDS_YOU = awaiting.length

/** Items awaiting a decision or blocked, oldest first: what is stuck. */
export const STUCK: readonly Item[] = ITEMS.filter(
  (i) => i.state === 'awaiting' || i.state === 'blocked',
).toSorted((a, b) => b.waitHours - a.waitHours)
/** The longest an item has waited on a decision; blocked items wait on something else. */
export const OLDEST_WAIT_HOURS = Math.max(0, ...awaiting.map((i) => i.waitHours))

/** The needs-you count at each day end, 14 days, ending on today's count. */
export const NEEDS_YOU_TREND: readonly number[] = [2, 3, 3, 4, 3, 2, 3, 4, 5, 4, 5, 4, 5, NEEDS_YOU]

export const NEEDS_YOU_POINTS = timedPoints(NEEDS_YOU_TREND, TODAY.getTime(), DAY_MS)

export const FLEET: readonly { state: ItemState; label: string; count: number }[] = ITEM_STATES.map(
  (state) => ({
    state,
    label: STATE_LABEL[state],
    count: ITEMS.filter((i) => i.state === state).length,
  }),
).filter((s) => s.count > 0)
export const FLEET_TOTAL = ITEMS.length

/** The 24 h the failures are read over: `end` is the reading time, `start` 24 h before it. */
export const FAILURES_WINDOW = {
  start: new Date(Date.UTC(2026, 9, 15, 15)),
  end: new Date(Date.UTC(2026, 9, 16, 15)),
}
const HOUR_MS = 3_600_000
/** When each failed run ended, oldest first (UTC). */
export const FAILURE_TIMES: readonly Date[] = [
  Date.UTC(2026, 9, 15, 19, 20),
  Date.UTC(2026, 9, 16, 8, 5),
  Date.UTC(2026, 9, 16, 13, 40),
].map((t) => new Date(t))
/** Failed agent runs in the last 24 h, and in the 24 h before. */
export const FAILURES_24H = { count: FAILURE_TIMES.length, prior: 1 }
/** Failed runs per hour over the last 24 h, oldest first; sums to `FAILURES_24H.count`. */
export const FAILURES_BY_HOUR: readonly number[] = Array.from({ length: 24 }, (_, h) => {
  const from = FAILURES_WINDOW.start.getTime() + h * HOUR_MS
  return FAILURE_TIMES.filter((t) => t.getTime() >= from && t.getTime() < from + HOUR_MS).length
})

/** `FAILURES_BY_HOUR` as points: the hour each bar starts, so the readout names it. */
export const FAILURES_POINTS = timedPoints(
  FAILURES_BY_HOUR,
  FAILURES_WINDOW.start.getTime() + 23 * HOUR_MS,
  HOUR_MS,
)

/** Dispatch spend per day in EUR, 14 days, oldest first; the last entry is today so far. */
export const DISPATCH_DAILY: readonly number[] = [
  4.2, 6.8, 5.1, 3.9, 7.4, 6.1, 2.8, 3.3, 8.2, 6.6, 5.9, 7.1, 6.4, 5.4,
]
export const BUDGETS = {
  day: { spent: 5.4, cap: 10 },
  week: { spent: DISPATCH_DAILY.slice(-7).reduce((a, b) => a + b, 0), cap: 50 },
}
/** The days that are over: today is partial, so a mean or a comparison leaves it out. */
export const DISPATCH_COMPLETE_DAYS: readonly number[] = DISPATCH_DAILY.slice(0, -1)
/** The complete days as points: the last is yesterday. */
export const DISPATCH_POINTS = timedPoints(DISPATCH_COMPLETE_DAYS, TODAY.getTime() - DAY_MS, DAY_MS)

export type FlowRow = { date: Date; opened: number; closed: number }

const OPENED = [3, 4, 1, 0, 5, 4, 3, 2, 4, 5, 1, 0, 4, 3]
const CLOSED = [2, 3, 2, 1, 3, 4, 3, 3, 2, 4, 3, 1, 2, 2]
/** Items opened and closed per day, 14 days, oldest first. */
export const FLOW: readonly FlowRow[] = OPENED.map((opened, i) => ({
  date: new Date(TODAY.getTime() - (OPENED.length - 1 - i) * DAY_MS),
  opened,
  closed: CLOSED[i] ?? 0,
}))
export const FLOW_OPENED = FLOW.reduce((a, r) => a + r.opened, 0)
export const FLOW_CLOSED = FLOW.reduce((a, r) => a + r.closed, 0)
/** `3–16 Oct`: the start names only its day while the window stays in one month. */
export const FLOW_RANGE_LABEL = `${(FLOW[0]?.date ?? TODAY).getUTCDate()}–${TODAY_LABEL}`

/** `5 h`, `1 d 2 h`, `2 d`: days once past a day, hours only while they still change the call. */
export function fmtAge(hours: number): string {
  const whole = Math.round(hours)
  if (whole < 24) return `${whole} h`
  const days = Math.floor(whole / 24)
  const rest = whole % 24
  return rest === 0 ? `${days} d` : `${days} d ${rest} h`
}

/** The item-flow series: the tooltip row carries the unit, not the series name again (`Opened 2 items`). */
export const FLOW_SERIES: ChartSeries<FlowRow>[] = [
  {
    key: 'opened',
    label: 'Opened',
    color: demoColors.sessions,
    getValue: (d) => d.opened,
    formatValue: (v) => `${fmtInt(v)} items`,
    // Daily integer counts: a smoothed curve would draw days that never happened.
    curve: 'linear',
  },
  {
    key: 'closed',
    label: 'Closed',
    color: demoColors.signups,
    getValue: (d) => d.closed,
    formatValue: (v) => `${fmtInt(v)} items`,
    curve: 'linear',
  },
]

/** The item whose history the S3 timeline shows: `w-421`, awaiting a decision for 30 h. */
export const TIMELINE_ITEM = 'Raise queue concurrency'

export type TransitionEvent = {
  kind: 'transition'
  id: string
  at: Date
  /** `null` on the synthetic `created` row. */
  from: string | null
  to: string
  reason?: string
  synthetic?: boolean
}
export type DispatchEvent = {
  kind: 'dispatch'
  id: string
  /** When the dispatch was created. */
  at: Date
  tier: 'light' | 'standard' | 'deep'
  status: 'merged' | 'failed' | 'closed' | 'open'
  /** One sentence: what the run concluded. */
  verdict: string
  mergedAt?: Date
}
export type OperationEvent = {
  kind: 'operation'
  id: string
  at: Date
  op: 'checkout' | 'build' | 'test' | 'review' | 'deploy' | 'rebase'
  repo: string
  outcome: 'ok' | 'failed' | 'skipped'
}
export type TimelineEvent = TransitionEvent | DispatchEvent | OperationEvent

const at = (day: number, hour: number, minute: number): Date =>
  new Date(Date.UTC(2026, 9, day, hour, minute))
let seq = 0
const nextId = (): string => `e-${String(++seq).padStart(2, '0')}`
const tr = (
  when: Date,
  from: string | null,
  to: string,
  reason?: string,
  synthetic?: boolean,
): TransitionEvent => ({
  kind: 'transition',
  id: nextId(),
  at: when,
  from,
  to,
  ...(reason !== undefined && { reason }),
  ...(synthetic === true && { synthetic }),
})
const dp = (
  when: Date,
  tier: DispatchEvent['tier'],
  status: DispatchEvent['status'],
  verdict: string,
  mergedAt?: Date,
): DispatchEvent => ({
  kind: 'dispatch',
  id: nextId(),
  at: when,
  tier,
  status,
  verdict,
  ...(mergedAt !== undefined && { mergedAt }),
})
const op = (
  when: Date,
  kind: OperationEvent['op'],
  repo: string,
  outcome: OperationEvent['outcome'],
): OperationEvent => ({ kind: 'operation', id: nextId(), at: when, op: kind, repo, outcome })

/**
 * One warden item's history, OLDEST FIRST (warden's order), over five days ending at the transition
 * that put it in `awaiting` (30 h before `TODAY`, matching `w-421` in `ITEMS`). It is the last
 * `ITEM_TIMELINE.length` of `ITEM_TIMELINE_TOTAL` events.
 */
export const ITEM_TIMELINE: readonly TimelineEvent[] = [
  tr(at(10, 9, 12), null, 'queued', 'Opened from a capacity report', true),
  tr(at(10, 9, 40), 'queued', 'running', 'Slot free'),
  op(at(10, 9, 41), 'checkout', 'queue-service', 'ok'),
  dp(
    at(10, 9, 44),
    'light',
    'failed',
    'The worker pool is sized in two places, so the change is not local.',
  ),
  op(at(10, 10, 2), 'test', 'queue-service', 'failed'),
  tr(at(10, 10, 5), 'running', 'blocked', 'Pool size is read from the deploy config'),
  tr(at(10, 14, 30), 'blocked', 'queued', 'Deploy config repo added to the scope'),
  tr(at(10, 15, 3), 'queued', 'running', 'Slot free'),
  op(at(10, 15, 4), 'checkout', 'deploy-config', 'ok'),
  op(at(10, 15, 5), 'checkout', 'queue-service', 'ok'),
  dp(
    at(10, 15, 9),
    'standard',
    'open',
    'Raised the default from 4 to 8 and read it from one setting.',
  ),
  op(at(10, 15, 41), 'build', 'queue-service', 'ok'),
  op(at(10, 15, 52), 'test', 'queue-service', 'ok'),
  op(at(10, 16, 20), 'review', 'queue-service', 'failed'),
  tr(at(10, 16, 24), 'running', 'awaiting', 'Review found an unbounded retry loop'),
  tr(at(11, 8, 31), 'awaiting', 'queued', 'Decision: bound the retries at 5'),
  tr(at(11, 8, 50), 'queued', 'running', 'Slot free'),
  dp(at(11, 8, 55), 'standard', 'closed', 'Superseded by a run that also bounds the retries.'),
  dp(
    at(11, 9, 0),
    'standard',
    'open',
    'Bounded the retry loop at 5 and kept the new pool default.',
  ),
  op(at(11, 9, 28), 'build', 'queue-service', 'ok'),
  op(at(11, 9, 37), 'test', 'queue-service', 'ok'),
  op(at(11, 10, 2), 'review', 'queue-service', 'ok'),
  tr(at(11, 10, 6), 'running', 'awaiting', 'Ready to merge'),
  tr(at(11, 17, 14), 'awaiting', 'running', 'Approved'),
  op(at(11, 17, 16), 'rebase', 'queue-service', 'ok'),
  dp(
    at(11, 17, 20),
    'light',
    'merged',
    'Merged after a clean rebase; the pool default is now 8.',
    at(11, 17, 31),
  ),
  op(at(11, 17, 33), 'deploy', 'queue-service', 'ok'),
  op(at(11, 17, 52), 'deploy', 'deploy-config', 'skipped'),
  tr(at(11, 18, 0), 'running', 'awaiting', 'Deployed, waiting on a canary read'),
  tr(at(12, 9, 5), 'awaiting', 'running', 'Canary read: queue depth fell by a third'),
  op(at(12, 9, 6), 'checkout', 'queue-service', 'ok'),
  dp(
    at(12, 9, 10),
    'light',
    'merged',
    'Raised the staging pool to match production.',
    at(12, 9, 24),
  ),
  op(at(12, 9, 26), 'deploy', 'deploy-config', 'ok'),
  tr(at(12, 9, 40), 'running', 'queued', 'Waiting for the staging window'),
  tr(at(12, 15, 2), 'queued', 'running', 'Staging window open'),
  op(at(12, 15, 4), 'test', 'queue-service', 'ok'),
  op(at(12, 15, 30), 'test', 'deploy-config', 'failed'),
  dp(
    at(12, 15, 34),
    'standard',
    'failed',
    'The staging smoke test timed out on the second worker.',
  ),
  tr(at(12, 15, 40), 'running', 'blocked', 'Failing check on staging'),
  tr(at(13, 10, 18), 'blocked', 'queued', 'Staging check fixed upstream'),
  tr(at(13, 10, 44), 'queued', 'running', 'Slot free'),
  op(at(13, 10, 46), 'test', 'deploy-config', 'ok'),
  dp(at(13, 10, 50), 'deep', 'open', 'Proposed raising the cap to 12 with a per-queue override.'),
  op(at(13, 11, 40), 'review', 'queue-service', 'ok'),
  tr(at(14, 18, 0), 'running', 'awaiting', 'Needs a decision on the cap of 12'),
]

/** Warden keeps the whole history; the page fetches the last `ITEM_TIMELINE.length` of these. */
export const ITEM_TIMELINE_TOTAL = 57

/** The warden board: items by state as `Board` columns, `Done` empty on purpose (the empty-column line). The queue list and the Oldest wait cell carry the waits; the Awaiting and Blocked cards omit the age (Running cards keep it: the list does not carry them). */
const BOARD_AGE = (hours: number): string =>
  hours >= 24 ? `${Math.floor(hours / 24)} d ${hours % 24} h` : `${hours} h`

/** The agent that holds each card: the caption names who, the column already says what state. */
const BOARD_AGENTS = ['claude', 'codex', 'opencode'] as const
const BOARD_TYPES = ['PR review', 'Migration', 'Upgrade', 'Bug'] as const
const boardCard = (i: Item, extra?: { status?: string; href?: string }) => ({
  id: i.id,
  actor: BOARD_AGENTS[Number(i.id.slice(2)) % BOARD_AGENTS.length] ?? 'claude',
  type: BOARD_TYPES[Number(i.id.slice(2)) % BOARD_TYPES.length] ?? 'Bug',
  title: i.title,
  record: { label: i.id.toUpperCase(), href: extra?.href ?? `/warden/${i.id}` },
  status: extra?.status ?? 'Your decision',
})

export const BOARD_COLUMNS = [
  {
    id: 'needs-you',
    title: 'Awaiting',
    tone: VX.status.warn,
    empty: 'Nothing needs a decision',
    cards: ITEMS.filter((i) => i.state === 'awaiting').map((i) => boardCard(i)),
  },
  {
    id: 'working',
    title: 'Working',
    tone: VX.status.neutral,
    empty: 'No run in flight',
    cards: ITEMS.filter((i) => i.state === 'running').map((i) =>
      boardCard(i, { status: `Running ${BOARD_AGE(i.waitHours)}` }),
    ),
  },
  {
    id: 'blocked',
    title: 'Blocked',
    tone: VX.status.bad,
    empty: 'Nothing is blocked',
    cards: ITEMS.filter((i) => i.state === 'blocked').map((i) =>
      boardCard(i, { status: i.reason ?? 'Blocked' }),
    ),
  },
  { id: 'done', title: 'Done', tone: VX.status.good, empty: 'Nothing finished today', cards: [] },
] as const
