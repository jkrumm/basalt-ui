/**
 * `EventList`'s pure half: day grouping and the labels. Local-time day boundaries, the caller's
 * order kept (a group is a run of adjacent items on one local day, never a re-sort).
 */
import type { ReactNode } from 'react'
import { date, dateTime, relativeTime, time, weekday } from '../format'

export type EventTimeMode = 'clock' | 'relative' | 'date-time' | ((at: Date) => string)

export const toEventDate = (at: Date | number): Date => (at instanceof Date ? at : new Date(at))

export const isValidEventDate = (at: Date): boolean => Number.isFinite(at.getTime())

/** Shown in the time column of a row whose `at` is not a real instant. */
const NO_TIME = '—'

/** Local calendar day, `YYYY-MM-DD`. */
export function dayKey(at: Date): string {
  const month = String(at.getMonth() + 1).padStart(2, '0')
  const day = String(at.getDate()).padStart(2, '0')
  return `${at.getFullYear()}-${month}-${day}`
}

export type EventGroup<T extends { readonly at: Date | number }> = {
  readonly day: Date
  /** The local day, `YYYY-MM-DD`, or `invalid` for a list with no real instant. */
  readonly key: string
  /** `key` plus the run's occurrence, so a same-day prepend keeps every group's identity. */
  readonly id: string
  readonly items: readonly T[]
}

/**
 * Runs of adjacent items on one local day, in the order given. An item whose `at` is invalid has no
 * day of its own: it joins the run before it, or (leading) the first real run that follows. A list
 * with no real instant at all is one group on an invalid day, which renders without a header.
 */
export function groupByDay<T extends { readonly at: Date | number }>(
  items: readonly T[],
): EventGroup<T>[] {
  const runs: { day: Date; key: string; items: T[] }[] = []
  const leading: T[] = []
  for (const item of items) {
    const at = toEventDate(item.at)
    const last = runs[runs.length - 1]
    if (!isValidEventDate(at)) {
      if (last === undefined) leading.push(item)
      else last.items.push(item)
      continue
    }
    const key = dayKey(at)
    if (last !== undefined && last.key === key) last.items.push(item)
    else runs.push({ day: at, key, items: runs.length === 0 ? [...leading, item] : [item] })
  }
  if (runs.length === 0) {
    return leading.length === 0
      ? []
      : [{ day: new Date(Number.NaN), key: 'invalid', id: 'invalid#0', items: leading }]
  }
  const seen = new Map<string, number>()
  return runs.map((run) => {
    const n = seen.get(run.key) ?? 0
    seen.set(run.key, n + 1)
    return { ...run, id: `${run.key}#${n}` }
  })
}

/** `Today`, `Yesterday`, else `Wed, Sep 2, 2026`. With no clock yet (the server render) always the date. */
export function defaultDayLabel(day: Date, now: Date | null): string {
  if (!isValidEventDate(day)) return NO_TIME
  if (now === null) return `${weekday(day)}, ${date(day)}`
  const key = dayKey(day)
  if (key === dayKey(now)) return 'Today'
  const before = new Date(now)
  before.setDate(before.getDate() - 1)
  if (key === dayKey(before)) return 'Yesterday'
  return `${weekday(day)}, ${date(day)}`
}

export function formatEventTime(at: Date, mode: EventTimeMode, now: Date | null): string {
  if (!isValidEventDate(at)) return NO_TIME
  if (typeof mode === 'function') return mode(at)
  // Relative needs a clock; before there is one (the server render) the absolute stamp stands in.
  if (mode === 'relative' && now !== null) return relativeTime(at, { now: now.getTime() })
  if (mode === 'relative') return dateTime(at, { format: 'short' })
  if (mode === 'date-time') return dateTime(at, { format: 'short' })
  return time(at, { format: 'short' })
}

/** What every row (real or skeleton) shares: the list's density, rail, lead column, time mode and "now". */
export type RowContext = {
  readonly density: 'feed' | 'timeline'
  readonly rail: boolean
  readonly lead: boolean
  readonly timeMode: EventTimeMode
  /** `null` until the client clock is read (the server render and the hydrating paint). */
  readonly now: Date | null
}

/** `null`, `undefined`, booleans and the empty string render nothing, so they are not content. */
export const present = (node: ReactNode): boolean =>
  node !== undefined && node !== null && typeof node !== 'boolean' && node !== ''

/** The data attributes a row (real or skeleton) carries; the CSS keys on them. */
export function rowAttributes(ctx: RowContext, first: boolean, last: boolean) {
  return {
    'data-density': ctx.density,
    'data-lead': ctx.lead ? '' : undefined,
    'data-rail': ctx.rail ? '' : undefined,
    'data-first': first ? '' : undefined,
    'data-last': last ? '' : undefined,
  }
}
