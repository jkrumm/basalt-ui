import { DAYS, DAY_MS, SOURCES, WEEK_START, WINDOW_END, WINDOW_START } from './fixture'
import type { Message, SourceId } from './fixture'

/** One source on one day: the grain the heat grid draws and every part shares one focus over. */
export type Cell = {
  source: SourceId
  name: string
  /** The day's UTC midnight. */
  at: number
  /** The day as a stable key, `2026-11-16`. */
  day: string
  count: number
  untagged: number
  unread: number
  /** The source's usual count for this kind of day (weekday or weekend), the median over the window. */
  usual: number
  /** Received before the last 7 days. */
  older: boolean
  /** The oldest untagged message of the day, or null. */
  oldestUntagged: number | null
}

/** One source over the last 7 days. */
export type Row = {
  id: SourceId
  name: string
  week: number
  previous: number
  tagged: number
  untagged: number
  /** Untagged messages received before the last 7 days. */
  older: number
  unread: number
  oldestUntagged: number | null
}

export type Summary = {
  cells: readonly Cell[]
  /** Sorted by this week's mail, most first. */
  rows: readonly Row[]
  week: number
  previous: number
  untagged: number
  older: number
  /** The oldest untagged message in the window, or null. */
  oldestUntagged: number | null
  max: number
  messages: number
}

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const upper = sorted[mid] ?? 0
  return sorted.length % 2 === 1 ? upper : ((sorted[mid - 1] ?? 0) + upper) / 2
}

export const dayKey = (at: number): string => new Date(at).toISOString().slice(0, 10)

const oldest = (a: number | null, b: number | null): number | null =>
  a === null ? b : b === null ? a : Math.min(a, b)

export function summarize(messages: readonly Message[]): Summary {
  const cells: Cell[] = []
  for (const source of SOURCES) {
    const own = messages.filter((m) => m.source === source.id)
    const days: Cell[] = []
    for (let d = 0; d < DAYS; d += 1) {
      const at = WINDOW_START + d * DAY_MS
      const ofDay = own.filter((m) => m.receivedAt >= at && m.receivedAt < at + DAY_MS)
      const none = ofDay.filter((m) => m.tags.length === 0)
      days.push({
        source: source.id,
        name: source.name,
        at,
        day: dayKey(at),
        count: ofDay.length,
        untagged: none.length,
        unread: ofDay.filter((m) => !m.read).length,
        usual: 0,
        older: at < WEEK_START,
        oldestUntagged: none.reduce<number | null>((o, m) => oldest(o, m.receivedAt), null),
      })
    }
    const isWeekend = (c: Cell): boolean => [0, 6].includes(new Date(c.at).getUTCDay())
    const weekday = median(days.filter((c) => !isWeekend(c)).map((c) => c.count))
    const weekend = median(days.filter(isWeekend).map((c) => c.count))
    for (const c of days) cells.push({ ...c, usual: isWeekend(c) ? weekend : weekday })
  }
  const rows: Row[] = SOURCES.map((s) => {
    const own = cells.filter((c) => c.source === s.id)
    const recent = own.filter((c) => !c.older)
    const before = own.filter((c) => c.older)
    const sum = (list: readonly Cell[], key: 'count' | 'untagged' | 'unread'): number =>
      list.reduce((t, c) => t + c[key], 0)
    return {
      id: s.id,
      name: s.name,
      week: sum(recent, 'count'),
      previous: sum(before, 'count'),
      tagged: sum(recent, 'count') - sum(recent, 'untagged'),
      untagged: sum(recent, 'untagged'),
      older: sum(before, 'untagged'),
      unread: sum(recent, 'unread'),
      oldestUntagged: own.reduce<number | null>((o, c) => oldest(o, c.oldestUntagged), null),
    }
  }).sort((a, b) => b.week - a.week)
  const total = (key: 'week' | 'previous' | 'untagged' | 'older'): number =>
    rows.reduce((t, r) => t + r[key], 0)
  return {
    cells: rows.flatMap((r) => cells.filter((c) => c.source === r.id)),
    rows,
    week: total('week'),
    previous: total('previous'),
    untagged: total('untagged'),
    older: total('older'),
    oldestUntagged: rows.reduce<number | null>((o, r) => oldest(o, r.oldestUntagged), null),
    max: cells.reduce((m, c) => Math.max(m, c.count), 0),
    messages: messages.length,
  }
}

/** Whole days between a message and the window's end. */
export const ageDays = (at: number): number => Math.floor((WINDOW_END - at) / DAY_MS)
