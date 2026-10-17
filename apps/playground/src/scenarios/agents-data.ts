/**
 * S3 fixture data: the agent work queue, shaped like argo's warden and agents pages. Hand-authored
 * and deterministic — a screenshot and a reload read the same numbers. Ages are hours before the
 * reading date `TODAY`; every derived figure the page states is computed here so it cannot drift
 * from the list it summarises.
 */

import { fmtDay } from './fixture-utils'

/** The reading date. Fixed, so the 14-day windows never move under a screenshot. */
const TODAY = new Date(Date.UTC(2026, 9, 16))
const DAY_MS = 86_400_000
export const TODAY_LABEL = fmtDay(TODAY)

export const ITEM_STATES = ['awaiting', 'running', 'queued', 'blocked'] as const
export type ItemState = (typeof ITEM_STATES)[number]

/** Status word per state; the page pairs it with a dot, never colour alone. */
export const STATE_LABEL: Record<ItemState, string> = {
  awaiting: 'Needs you',
  running: 'Running',
  queued: 'Queued',
  blocked: 'Blocked',
}

export type Item = {
  id: string
  title: string
  repo: string
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
  repo: string,
  state: ItemState,
  waitHours: number,
  title: string,
  reason?: string,
): Item => ({
  id,
  title,
  repo,
  state,
  waitHours,
  ...(reason !== undefined && { reason }),
})

export const ITEMS: readonly Item[] = [
  item('w-412', 'api', 'awaiting', 71, 'Drop the legacy session table'),
  item('w-418', 'dashboard', 'awaiting', 49, 'Replace the polling hook with a stream'),
  item('w-421', 'worker', 'awaiting', 30, 'Raise the queue concurrency to 8'),
  item('w-427', 'infra', 'awaiting', 19, 'Rotate the deploy token'),
  item('w-431', 'api', 'awaiting', 7, 'Add rate limiting to the export route'),
  item('w-433', 'dashboard', 'awaiting', 3, 'Move the settings page to the new shell'),
  item('w-425', 'worker', 'running', 2, 'Backfill the usage ledger'),
  item('w-429', 'api', 'running', 5, 'Split the billing module'),
  item('w-430', 'dashboard', 'running', 1, 'Fix the chart legend overflow'),
  item('w-432', 'infra', 'running', 4, 'Pin the base image digest'),
  item('w-434', 'worker', 'queued', 6, 'Retry failed webhooks with backoff'),
  item('w-435', 'api', 'queued', 4, 'Document the pagination cursor'),
  item('w-436', 'dashboard', 'queued', 3, 'Add an empty state to the run list'),
  item('w-437', 'infra', 'queued', 2, 'Prune stale preview environments'),
  item('w-438', 'api', 'queued', 2, 'Cache the project lookup'),
  item('w-439', 'worker', 'queued', 1, 'Log the job id on every retry'),
  item('w-422', 'dashboard', 'blocked', 52, 'Upgrade the router major', 'Waits on the API change'),
  item('w-424', 'api', 'blocked', 28, 'Migrate the audit log to the new store', 'Failing check'),
  item(
    'w-428',
    'infra',
    'blocked',
    14,
    'Enable the staging cluster autoscaler',
    'Waits on the infra quota',
  ),
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

export const FLEET: readonly { state: ItemState; label: string; count: number }[] = ITEM_STATES.map(
  (state) => ({
    state,
    label: STATE_LABEL[state],
    count: ITEMS.filter((i) => i.state === state).length,
  }),
).filter((s) => s.count > 0)
export const FLEET_TOTAL = ITEMS.length

/** Failed agent runs in the last 24 h, and in the 24 h before. */
export const FAILURES_24H = { count: 3, prior: 1 }
/** Failed runs per hour over the last 24 h, oldest first; sums to `FAILURES_24H.count`. */
export const FAILURES_BY_HOUR: readonly number[] = [
  0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0,
]

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
export const FLOW_RANGE_LABEL = `${fmtDay(FLOW[0]?.date ?? TODAY)}–${TODAY_LABEL}`

/** `5 h`, `1 d 2 h`, `2 d`: days once past a day, hours only while they still change the call. */
export function fmtAge(hours: number): string {
  const whole = Math.round(hours)
  if (whole < 24) return `${whole} h`
  const days = Math.floor(whole / 24)
  const rest = whole % 24
  return rest === 0 ? `${days} d` : `${days} d ${rest} h`
}
