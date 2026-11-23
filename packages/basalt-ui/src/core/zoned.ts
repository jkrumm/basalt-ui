/**
 * Calendar days in a time zone: the day an instant falls on, the instant a day starts, and the
 * week and month grids a calendar draws. Days are `YYYY-MM-DD` strings (`CalendarDate`), never a
 * `Date`, so a day means the same thing in every zone; instants are epoch ms. Zone offsets come
 * from `Intl.DateTimeFormat`, so no date library is needed. `useCalendarDefaults` reads the zone,
 * the locale and the week start the app's `BasaltProvider` sets.
 *
 * Runtime imports: `react` and the provider only.
 */
import type { CalendarDate } from './format'
import { useProviderContext } from './provider'
import { useIntl } from './provider-props'

const DAY_MS = 86_400_000
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/

/** A weekday, 0 Sunday to 6 Saturday, as `Date#getUTCDay` counts. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

const pad = (n: number, width = 2): string => String(n).padStart(width, '0')

/** The UTC midnight of a day, as a `Date`-free number; `NaN` for a string that is no day. */
function utcOf(day: CalendarDate): number {
  const m = ISO_DAY.exec(day)
  if (m === null) return Number.NaN
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function dayOfUtc(ms: number): CalendarDate {
  const d = new Date(ms)
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` as CalendarDate
}

/** Whether the string names a day that exists (`2026-02-31` does not). */
export function isCalendarDate(value: string): value is CalendarDate {
  const ms = utcOf(value as CalendarDate)
  return !Number.isNaN(ms) && dayOfUtc(ms) === value
}

/** The day `n` days after `day` (before, for a negative `n`). */
export function addDays(day: CalendarDate, n: number): CalendarDate {
  return dayOfUtc(utcOf(day) + n * DAY_MS)
}

/** The same day of the month `n` months on, held to the month's last day (Jan 31 + 1 is Feb 28). */
export function addMonths(day: CalendarDate, n: number): CalendarDate {
  const d = new Date(utcOf(day))
  const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n + 1, 0)).getUTCDate()
  return dayOfUtc(first + (Math.min(d.getUTCDate(), last) - 1) * DAY_MS)
}

/** Whole days from `a` to `b`. */
export function daysBetween(a: CalendarDate, b: CalendarDate): number {
  return Math.round((utcOf(b) - utcOf(a)) / DAY_MS)
}

export function weekdayOf(day: CalendarDate): Weekday {
  return new Date(utcOf(day)).getUTCDay() as Weekday
}

/** The first day of the week `day` is in, for a week that starts on `weekStart`. */
export function startOfWeek(day: CalendarDate, weekStart: Weekday): CalendarDate {
  return addDays(day, -((weekdayOf(day) - weekStart + 7) % 7))
}

/** The first day of `day`'s month. */
export function startOfMonth(day: CalendarDate): CalendarDate {
  return `${day.slice(0, 8)}01` as CalendarDate
}

/** The seven days of `day`'s week, in order. */
export function weekOf(day: CalendarDate, weekStart: Weekday): CalendarDate[] {
  const first = startOfWeek(day, weekStart)
  return Array.from({ length: 7 }, (_, i) => addDays(first, i))
}

/** The 42 days (six weeks) a month grid draws for `day`'s month, from the week its first day is in. */
export function monthGridOf(day: CalendarDate, weekStart: Weekday): CalendarDate[] {
  const first = startOfWeek(startOfMonth(day), weekStart)
  return Array.from({ length: 42 }, (_, i) => addDays(first, i))
}

const partsFormats = new Map<string, Intl.DateTimeFormat>()

function partsFormat(zone: string): Intl.DateTimeFormat {
  let f = partsFormats.get(zone)
  if (f === undefined) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
    partsFormats.set(zone, f)
  }
  return f
}

/** The wall-clock fields of an instant in a zone. */
function wallOf(
  ms: number,
  zone: string,
): { y: number; mo: number; d: number; h: number; mi: number; s: number } {
  const out = { y: 0, mo: 0, d: 0, h: 0, mi: 0, s: 0 }
  for (const p of partsFormat(zone).formatToParts(ms)) {
    const v = Number(p.value)
    if (p.type === 'year') out.y = v
    else if (p.type === 'month') out.mo = v
    else if (p.type === 'day') out.d = v
    else if (p.type === 'hour') out.h = v % 24
    else if (p.type === 'minute') out.mi = v
    else if (p.type === 'second') out.s = v
  }
  return out
}

/** The zone's offset from UTC at an instant, in ms (Berlin in winter: 3 600 000). */
export function offsetAt(ms: number, zone: string): number {
  const w = wallOf(ms, zone)
  const asUtc = Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s)
  return asUtc - Math.floor(ms / 1000) * 1000
}

/** The day an instant falls on in a zone, and its minutes since that day's midnight (0 to 1439). */
export function zonedDay(ms: number, zone: string): { day: CalendarDate; minutes: number } {
  const w = wallOf(ms, zone)
  return {
    day: `${pad(w.y, 4)}-${pad(w.mo)}-${pad(w.d)}` as CalendarDate,
    minutes: w.h * 60 + w.mi + w.s / 60,
  }
}

/** The instant a day's wall clock reads `minutes` past midnight in a zone (its start, by default). */
export function zonedInstant(day: CalendarDate, zone: string, minutes = 0): number {
  const wall = utcOf(day) + minutes * 60_000
  // The offset at the wall time read as UTC is right except within a few hours of a switch:
  // a second pass with the offset at the first guess settles it.
  const first = wall - offsetAt(wall, zone)
  return wall - offsetAt(first, zone)
}

/** Today in a zone. */
export function todayIn(now: number, zone: string): CalendarDate {
  return zonedDay(now, zone).day
}

/**
 * The first day of the week for a locale (0 Sunday, 1 Monday): `Intl.Locale#getWeekInfo` where the
 * runtime has it, else Monday, the ISO week.
 */
export function weekStartOf(locale: string): Weekday {
  try {
    const l = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number }
      weekInfo?: { firstDay: number }
    }
    const first = l.getWeekInfo?.().firstDay ?? l.weekInfo?.firstDay
    return first === undefined ? 1 : ((first % 7) as Weekday)
  } catch {
    return 1
  }
}

export type CalendarDefaults = {
  /** BCP 47 tag the app formats in. */
  locale: string
  /** IANA zone the app shows instants in. */
  timeZone: string
  weekStart: Weekday
}

/**
 * The locale, zone and week start the provider sets (`BasaltProvider` `locale` and `timeZone`),
 * else English, UTC and the locale's week start: the defaults `useFormat` prints with.
 */
export function useCalendarDefaults(): CalendarDefaults {
  const intl = useIntl()
  const providerLocale = useProviderContext().locale
  const locale = intl.locale ?? providerLocale ?? 'en'
  const zone = intl.timeZone
  const timeZone =
    zone === undefined
      ? 'UTC'
      : zone === 'host'
        ? new Intl.DateTimeFormat().resolvedOptions().timeZone
        : zone
  return { locale, timeZone, weekStart: weekStartOf(locale) }
}
