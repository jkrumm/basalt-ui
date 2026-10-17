/**
 * Date/time/duration formatting (`date`/`time`/`dateTime`/`weekday`/`relativeTime`/`duration`/`durationClock`),
 * seeded from argo consumers (`features/{walking-pad,reading,astro-window,garmin-health}/{formatters,format,
 * formulas}.ts` — read those files' own JSDoc for the exact call sites this generalizes).
 */
import { dateFormat, NON_FINITE, numberFormat, toDate } from './shared'
import type { LocaleOption } from './shared'

type DateInput = Date | number | string | null | undefined

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * A plain `YYYY-MM-DD` is a calendar date, not an instant. Returns `undefined` when `value` is not
 * one, `null` when it is shaped like one but names no real day (`2026-02-31`), else midnight of
 * that day — in UTC or in the local zone. `setFullYear` (not the `Date` constructor) so years
 * 0–99 are not remapped to 19xx; the round-trip check rejects the overflow `Date` would roll over.
 */
function calendarDate(value: string, utc: boolean): Date | null | undefined {
  const match = CALENDAR_DATE.exec(value)
  if (match === null) return undefined
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const result = new Date(0)
  if (utc) {
    result.setUTCFullYear(year, month, day)
    result.setUTCHours(0, 0, 0, 0)
    const ok =
      result.getUTCFullYear() === year &&
      result.getUTCMonth() === month &&
      result.getUTCDate() === day
    return ok ? result : null
  }
  result.setFullYear(year, month, day)
  result.setHours(0, 0, 0, 0)
  const ok =
    result.getFullYear() === year && result.getMonth() === month && result.getDate() === day
  return ok ? result : null
}

export type WeekdayOptions = LocaleOption & {
  /** `Intl.DateTimeFormat`'s own weekday widths. Default `'short'` (`"Mon"`). */
  format?: 'short' | 'long' | 'narrow'
}

/** Weekday name — seeded from `astro-window/formulas.ts#fmtWeekday`. A plain `YYYY-MM-DD` string
 * is parsed as a LOCAL calendar date (never UTC), matching that seed's own rationale: the weekday
 * must not shift a day depending on the reader's timezone. A non-finite/unparseable input (or a
 * day that does not exist, `2026-02-31`) prints {@link NON_FINITE}. */
export function weekday(value: Date | number | string, options: WeekdayOptions = {}): string {
  const parsed = typeof value === 'string' ? calendarDate(value, false) : undefined
  const resolved = parsed === undefined ? toDate(value) : parsed
  if (resolved === null) return NON_FINITE
  const { locale, format = 'short' } = options
  return dateFormat(locale, { weekday: format }).format(resolved)
}

export type RelativeTimeOptions = LocaleOption & {
  /** `Intl.RelativeTimeFormat` width. Default `'long'` (`"3 hours ago"`); `'short'` is `"3 hr. ago"`. */
  style?: 'long' | 'short' | 'narrow'
  /** `'auto'` (default) uses idioms (`"yesterday"`, `"now"`); `'always'` keeps the number. */
  numeric?: 'auto' | 'always'
  /** The reference "now" instant, epoch ms. Default `Date.now()` — mainly for tests. */
  now?: number
}

const MINUTE_MS = 60_000

/** Largest first. The unit is picked by magnitude; the count is rounded on the absolute value
 * (so +/- are symmetric) and the unit is promoted only once the rounded count fills the next
 * larger unit — 45 minutes stays `45 minutes`, 59.6 minutes becomes `1 hour`. */
const RELATIVE_TIME_UNITS: readonly {
  readonly unit: Intl.RelativeTimeFormatUnit
  readonly ms: number
}[] = [
  { unit: 'year', ms: 31_536_000_000 },
  { unit: 'month', ms: 2_628_000_000 },
  { unit: 'week', ms: 604_800_000 },
  { unit: 'day', ms: 86_400_000 },
  { unit: 'hour', ms: 3_600_000 },
  { unit: 'minute', ms: MINUTE_MS },
]

/** `format(-0, …)` reads "0 seconds ago"; `format(0, …)` reads "in 0 seconds". */
const NEGATIVE_ZERO = -0

const relativeTimeFormatterCache = new Map<string, Intl.RelativeTimeFormat>()

function relativeTimeFormat(
  locale: string | undefined,
  style: 'long' | 'short' | 'narrow',
  numeric: 'auto' | 'always',
): Intl.RelativeTimeFormat {
  // Same resolution as `numberFormat`/`dateFormat`: call locale, else the `defineFormat` default,
  // else the runtime's own. Reading it through `numberFormat` keeps one copy of the default; the
  // RESOLVED tag keys the cache, so a changed default never serves a stale instance.
  const resolved = locale ?? numberFormat(undefined, {}).resolvedOptions().locale
  const key = `${resolved}|${style}|${numeric}`
  const cached = relativeTimeFormatterCache.get(key)
  if (cached !== undefined) return cached
  const created = new Intl.RelativeTimeFormat(resolved, { style, numeric })
  relativeTimeFormatterCache.set(key, created)
  return created
}

/**
 * THE relative-time formatter on `Intl.RelativeTimeFormat` — `"3 hours ago"`, `"in 2 days"`,
 * `"now"`. Under a minute is `format(0, 'second')`, so "now" is the locale's own word. The count is
 * rounded before the unit is chosen, so 59.98 minutes reads `"1 hour ago"`, never
 * `"60 minutes ago"`. Accepts epoch ms, `Date` or an ISO string; `null`/`undefined`/unparseable
 * prints {@link NON_FINITE} (`Intl` throws a `RangeError` on non-finite input, and this is
 * render-path code where one bad timestamp must not blank a list).
 */
export function relativeTime(value: DateInput, options: RelativeTimeOptions = {}): string {
  const { locale, style = 'long', numeric = 'auto', now = Date.now() } = options
  const timestamp = value === null || value === undefined ? undefined : toDate(value)?.getTime()
  if (timestamp === undefined) return NON_FINITE
  const formatter = relativeTimeFormat(locale, style, numeric)
  const diffMs = timestamp - now
  const magnitude = Math.abs(diffMs)
  const sign = diffMs < 0 ? -1 : 1
  const index = RELATIVE_TIME_UNITS.findIndex(({ ms }) => magnitude >= ms)
  const picked = RELATIVE_TIME_UNITS[index]
  if (picked !== undefined) {
    const larger = RELATIVE_TIME_UNITS[index - 1]
    const unit =
      larger !== undefined && Math.round(magnitude / picked.ms) * picked.ms >= larger.ms
        ? larger
        : picked
    return formatter.format(sign * Math.round(magnitude / unit.ms), unit.unit)
  }
  return formatter.format(diffMs < 0 ? NEGATIVE_ZERO : 0, 'second')
}

export type DateOptions = LocaleOption & {
  /** `Intl.DateTimeFormat` `dateStyle`/`timeStyle` width. Default `'medium'`. */
  format?: 'short' | 'medium' | 'long'
  /** IANA zone. Default `undefined` — passed straight through to `Intl`. Ignored for a plain
   * `YYYY-MM-DD` string, which is a calendar date and prints the same day in every zone. */
  timeZone?: string
}

/** Resolves `value` to a `Date` plus the zone to format it in. A plain `YYYY-MM-DD` is pinned to
 * UTC midnight and formatted in UTC; anything unrepresentable is `null`. */
function resolveDateInput(
  value: DateInput,
  timeZone: string | undefined,
): { date: Date; timeZone: string | undefined } | null {
  if (value === null || value === undefined) return null
  const calendar = typeof value === 'string' ? calendarDate(value, true) : undefined
  if (calendar !== undefined) return calendar === null ? null : { date: calendar, timeZone: 'UTC' }
  const parsed = toDate(value)
  return parsed === null ? null : { date: parsed, timeZone }
}

/** Calendar date — `"Sep 2, 2026"`. `null`/`undefined`/unparseable prints {@link NON_FINITE}. */
export function date(value: DateInput, options: DateOptions = {}): string {
  const resolved = resolveDateInput(value, options.timeZone)
  if (resolved === null) return NON_FINITE
  const { locale, format = 'medium' } = options
  return dateFormat(locale, { dateStyle: format, timeZone: resolved.timeZone }).format(
    resolved.date,
  )
}

/** Time of day — `"3:04:05 PM"` (`format: 'short'`: `"3:04 PM"`). A plain `YYYY-MM-DD` string reads as midnight UTC. */
export function time(value: DateInput, options: DateOptions = {}): string {
  const resolved = resolveDateInput(value, options.timeZone)
  if (resolved === null) return NON_FINITE
  const { locale, format = 'medium' } = options
  return dateFormat(locale, { timeStyle: format, timeZone: resolved.timeZone }).format(
    resolved.date,
  )
}

/** Date and time — `"Sep 2, 2026, 3:04:05 PM"` (`format: 'short'`: `"9/2/26, 3:04 PM"`; the date/time
 * separator is the runtime's). */
export function dateTime(value: DateInput, options: DateOptions = {}): string {
  const resolved = resolveDateInput(value, options.timeZone)
  if (resolved === null) return NON_FINITE
  const { locale, format = 'medium' } = options
  return dateFormat(locale, {
    dateStyle: format,
    timeStyle: format,
    timeZone: resolved.timeZone,
  }).format(resolved.date)
}

/** Clock-style duration — `"1:02:03"`, `"04:12"`. Seeded from `walking-pad/
 * formatters.ts#formatDurationClock`. A non-finite value prints {@link NON_FINITE}. */
export function durationClock(seconds: number): string {
  if (!Number.isFinite(seconds)) return NON_FINITE
  const total = Math.max(0, Math.round(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export type DurationOptions = LocaleOption & {
  /** `'clock'` (default) `"1:02:03"`; `'compact'` `"1h 02m 03s"`; `'long'` `"1 hour 2 minutes 3 seconds"`. */
  style?: 'clock' | 'compact' | 'long'
  /** Largest unit `'compact'`/`'long'` break down to. Default `'hour'` (90 000 s is `"25h"`). */
  largest?: 'day' | 'hour' | 'minute'
}

const DURATION_UNITS = [
  { unit: 'day', short: 'd', seconds: 86_400 },
  { unit: 'hour', short: 'h', seconds: 3_600 },
  { unit: 'minute', short: 'm', seconds: 60 },
  { unit: 'second', short: 's', seconds: 1 },
] as const

/**
 * THE duration formatter. `'clock'` is {@link durationClock}; `'compact'` and `'long'` trim leading
 * and trailing zero units but keep a zero between two non-zero ones (`"1h 00m 03s"`); zero is
 * `"0s"` / `"0 seconds"`. `'long'` labels through `Intl.NumberFormat` unit style (locale-aware) —
 * `Intl.DurationFormat` is not in the pinned TS lib. `null`/`undefined`/non-finite prints
 * {@link NON_FINITE}; negatives clamp to zero.
 */
export function duration(
  seconds: number | null | undefined,
  options: DurationOptions = {},
): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return NON_FINITE
  const { style = 'clock', largest = 'hour', locale } = options
  if (style === 'clock') return durationClock(seconds)
  const total = Math.max(0, Math.round(seconds))
  const shown = DURATION_UNITS.slice(DURATION_UNITS.findIndex(({ unit }) => unit === largest))
  const parts = shown.map(({ unit, short, seconds: size }, i) => {
    const count = Math.floor(total / size)
    const upper = shown[i - 1]?.seconds
    return { unit, short, value: upper === undefined ? count : count % (upper / size) }
  })
  const firstNonZero = parts.findIndex(({ value }) => value > 0)
  const start = firstNonZero === -1 ? parts.length - 1 : firstNonZero
  const end = firstNonZero === -1 ? start : parts.findLastIndex(({ value }) => value > 0)
  return parts
    .slice(start, end + 1)
    .map(({ unit, short, value }, i) => {
      if (style === 'long') {
        return numberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' }).format(value)
      }
      const digits = i === 0 ? String(value) : String(value).padStart(2, '0')
      return `${digits}${short}`
    })
    .join(' ')
}
