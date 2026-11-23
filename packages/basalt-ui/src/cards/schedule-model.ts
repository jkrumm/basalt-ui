/**
 * The pure geometry of `Schedule`: which events fall on a day in the app's zone, where a timed
 * event sits in a day column (minutes from the window's top, its length and its lane among the
 * events it overlaps), and the all-day and month rows. Nothing here renders; `schedule.tsx` turns
 * minutes into px.
 */
import type { CalendarDate } from '../core/format'
import { packLanes } from '../core/lanes'
import type { Tone } from '../core/ports'
import { addDays, zonedDay, zonedInstant } from '../core/zoned'

/** An instant: epoch ms or a `Date`. */
export type ScheduleInstant = number | Date

/** One event. `start` and `end` are instants; the schedule shows them in the app's zone. */
export type ScheduleEvent = {
  id: string
  title: string
  start: ScheduleInstant
  end: ScheduleInstant
  /** Sits in the all-day row (week and day) and leads its day's rows (month), with no time. */
  allDay?: boolean | undefined
  /** The event's kind as a tone: its tint and its dot. Default `neutral`. */
  tone?: Tone | undefined
  /** The people on it, shown in its name and the up-next card. */
  attendees?: readonly string[] | undefined
}

export type ScheduleView = 'week' | 'month' | 'day'

export const msOf = (x: ScheduleInstant): number => (x instanceof Date ? x.getTime() : x)

/** A timed event placed in one day column, in minutes from that day's midnight. */
export type PlacedEvent<E extends ScheduleEvent> = {
  event: E
  /** Minutes from midnight to the event's start on this day (0 when it began the day before). */
  from: number
  /** Minutes from midnight to its end on this day (1440 when it runs past midnight). */
  to: number
  lane: number
  lanes: number
  /** It started on an earlier day, or runs on past this one. */
  continues: { before: boolean; after: boolean }
}

/** The day's start and end instants in a zone. */
function dayBounds(day: CalendarDate, zone: string): [number, number] {
  return [zonedInstant(day, zone), zonedInstant(addDays(day, 1), zone)]
}

const overlaps = (e: ScheduleEvent, from: number, to: number): boolean => {
  const s = msOf(e.start)
  const end = Math.max(s, msOf(e.end))
  // A zero-length event still sits on the day of its start.
  return s < to && (end > from || (end === s && s >= from))
}

/** Start order, then the longer first, then the id: one order for every view. */
export function byStart<E extends ScheduleEvent>(a: E, b: E): number {
  return (
    msOf(a.start) - msOf(b.start) ||
    msOf(b.end) - msOf(a.end) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  )
}

/**
 * The timed events on a day, each clipped to the day and packed into lanes. `minMinutes` is the
 * least length an event is drawn at, so two short events that would touch on screen pack as an
 * overlap and stand side by side instead of covering each other.
 */
export function placeDay<E extends ScheduleEvent>(
  events: readonly E[],
  day: CalendarDate,
  zone: string,
  minMinutes: number,
): PlacedEvent<E>[] {
  const [lo, hi] = dayBounds(day, zone)
  const on = events.filter((e) => e.allDay !== true && overlaps(e, lo, hi)).toSorted(byStart)
  const spans = on.map((e) => {
    const s = msOf(e.start)
    const end = Math.max(s, msOf(e.end))
    const from = s <= lo ? 0 : zonedDay(s, zone).minutes
    const to = end >= hi ? 1440 : Math.max(from, zonedDay(end, zone).minutes)
    return { e, from, to, before: s < lo, after: end > hi }
  })
  const packed = packLanes(
    spans.map((sp) => ({ start: sp.from, end: Math.max(sp.to, sp.from + minMinutes) })),
  )
  return spans.map((sp, i) => ({
    event: sp.e,
    from: sp.from,
    to: sp.to,
    lane: packed[i]?.lane ?? 0,
    lanes: packed[i]?.lanes ?? 1,
    continues: { before: sp.before, after: sp.after },
  }))
}

/** The all-day events on a day, in start order. */
export function allDayOn<E extends ScheduleEvent>(
  events: readonly E[],
  day: CalendarDate,
  zone: string,
): E[] {
  const [lo, hi] = dayBounds(day, zone)
  return events.filter((e) => e.allDay === true && overlaps(e, lo, hi)).toSorted(byStart)
}

/** Every event on a day, all-day ones first, then by start: a month cell's rows. */
export function eventsOn<E extends ScheduleEvent>(
  events: readonly E[],
  day: CalendarDate,
  zone: string,
): E[] {
  const [lo, hi] = dayBounds(day, zone)
  return events
    .filter((e) => overlaps(e, lo, hi))
    .toSorted((a, b) => Number(b.allDay === true) - Number(a.allDay === true) || byStart(a, b))
}

/** The next events: those not yet over at `now`, in start order, at most `count`. */
export function upNext<E extends ScheduleEvent>(
  events: readonly E[],
  now: number,
  count: number,
): E[] {
  return events
    .filter((e) => Math.max(msOf(e.start), msOf(e.end)) > now)
    .toSorted(byStart)
    .slice(0, count)
}

/** Whether an event is over at `now`: a past event draws dimmed. */
export const isPast = (e: ScheduleEvent, now: number): boolean =>
  Math.max(msOf(e.start), msOf(e.end)) <= now
