/**
 * Date/time/duration formatting (`date`/`time`/`dateTime`/`weekday`/`relativeTime`/`duration`/`durationClock`),
 * seeded from argo consumers (`features/{walking-pad,reading,astro-window,garmin-health}/{formatters,format,
 * formulas}.ts` — read those files' own JSDoc for the exact call sites this generalizes).
 */
import { dateFormat, NON_FINITE, numberFormat, toDate } from './shared'
import type { LocaleOption } from './shared'

export type WeekdayOptions = LocaleOption & {
  /** `Intl.DateTimeFormat`'s own weekday widths. Default `'short'` (`"Mon"`). */
  format?: 'short' | 'long' | 'narrow'
}

/** Weekday name — seeded from `astro-window/formulas.ts#fmtWeekday`. A plain `YYYY-MM-DD` string
 * is parsed as a LOCAL calendar date (never UTC), matching that seed's own rationale: the weekday
 * must not shift a day depending on the reader's timezone. A non-finite/unparseable input prints
 * {@link NON_FINITE}. */
export function weekday(value: Date | number | string, options: WeekdayOptions = {}): string {
  const date =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? (() => {
          const [y, m, d] = value.split('-').map(Number)
          return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
        })()
      : toDate(value)
  if (date === null) return NON_FINITE
  const { locale, format = 'short' } = options
  return dateFormat(locale, { weekday: format }).format(date)
}

export type RelativeTimeOptions = LocaleOption & {
  /** `Intl.RelativeTimeFormat` width. Default `'long'` (`"3 hours ago"`); `'short'` is `"3 hr. ago"`. */
  style?: 'long' | 'short' | 'narrow'
  /** `'auto'` (default) uses idioms (`"yesterday"`, `"now"`); `'always'` keeps the number. */
  numeric?: 'auto' | 'always'
  /** The reference "now" instant, epoch ms. Default `Date.now()` — mainly for tests. */
  now?: number
}

const RELATIVE_TIME_UNITS: readonly {
  readonly unit: Intl.RelativeTimeFormatUnit
  readonly ms: number
}[] = [
  { unit: 'year', ms: 31_536_000_000 },
  { unit: 'month', ms: 2_628_000_000 },
  { unit: 'week', ms: 604_800_000 },
  { unit: 'day', ms: 86_400_000 },
  { unit: 'hour', ms: 3_600_000 },
  { unit: 'minute', ms: 60_000 },
]

const relativeTimeFormatterCache = new Map<string, Intl.RelativeTimeFormat>()

function relativeTimeFormat(
  locale: string | undefined,
  options: Intl.RelativeTimeFormatOptions,
): Intl.RelativeTimeFormat {
  const key = `${locale ?? ''}|${JSON.stringify(options)}`
  const cached = relativeTimeFormatterCache.get(key)
  if (cached !== undefined) return cached
  const created = new Intl.RelativeTimeFormat(locale, options)
  relativeTimeFormatterCache.set(key, created)
  return created
}

function toTimestamp(value: Date | number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null
  const timestamp =
    value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

/**
 * THE relative-time formatter on `Intl.RelativeTimeFormat` — `"3 hours ago"`, `"in 2 days"`,
 * `"now"`. Under a minute is `format(0, 'second')`, so "now" is the locale's own word. The count is
 * rounded FIRST and the unit promoted after, so 59.98 minutes reads `"1 hour ago"`, never
 * `"60 minutes ago"`. Accepts epoch ms, `Date` or an ISO string; `null`/`undefined`/unparseable
 * prints {@link NON_FINITE} (`Intl` throws a `RangeError` on non-finite input, and this is
 * render-path code where one bad timestamp must not blank a list).
 */
export function relativeTime(
  value: number | Date | string | null | undefined,
  options: RelativeTimeOptions = {},
): string {
  const { locale, style = 'long', numeric = 'auto', now = Date.now() } = options
  const timestamp = toTimestamp(value)
  if (timestamp === null) return NON_FINITE
  const formatter = relativeTimeFormat(locale, { style, numeric })
  const diffMs = timestamp - now
  const absMs = Math.abs(diffMs)
  if (absMs < 60_000) return formatter.format(diffMs < 0 ? -0 : 0, 'second') // -0 keeps "0 seconds ago" in numeric: 'always'
  let index = RELATIVE_TIME_UNITS.findIndex(({ ms }) => absMs >= ms)
  let count = Math.round(diffMs / RELATIVE_TIME_UNITS[index]!.ms)
  const larger = RELATIVE_TIME_UNITS[index - 1]
  if (larger !== undefined && Math.abs(count) * RELATIVE_TIME_UNITS[index]!.ms >= larger.ms) {
    index -= 1
    count = Math.round(diffMs / larger.ms)
  }
  return formatter.format(count, RELATIVE_TIME_UNITS[index]!.unit)
}

export type DateOptions = LocaleOption & {
  /** `Intl.DateTimeFormat` `dateStyle`/`timeStyle` width. Default `'medium'`. */
  format?: 'short' | 'medium' | 'long'
  /** IANA zone. Default `undefined` — passed straight through to `Intl`. */
  timeZone?: string
}

type DateInput = Date | number | string | null | undefined

/** A plain `YYYY-MM-DD` is a calendar date, not an instant: pin it to UTC midnight and format in
 * UTC so it prints the same day in every reader's zone. */
function resolveDateInput(
  value: DateInput,
  timeZone: string | undefined,
): { date: Date; timeZone: string | undefined } | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-').map(Number)
    return { date: new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)), timeZone: 'UTC' }
  }
  const parsed = toDate(value)
  return parsed === null ? null : { date: parsed, timeZone }
}

function formatDateParts(
  value: DateInput,
  options: DateOptions,
  parts: { date: boolean; time: boolean },
): string {
  const { locale, format = 'medium', timeZone } = options
  const resolved = resolveDateInput(value, timeZone)
  if (resolved === null) return NON_FINITE
  return dateFormat(locale, {
    ...(parts.date ? { dateStyle: format } : {}),
    ...(parts.time ? { timeStyle: format } : {}),
    timeZone: resolved.timeZone,
  }).format(resolved.date)
}

/** Calendar date — `"Sep 2, 2026"`. `null`/`undefined`/unparseable prints {@link NON_FINITE}. */
export function date(value: DateInput, options: DateOptions = {}): string {
  return formatDateParts(value, options, { date: true, time: false })
}

/** Time of day — `"3:04 PM"`. A date-only `YYYY-MM-DD` string reads as midnight UTC. */
export function time(value: DateInput, options: DateOptions = {}): string {
  return formatDateParts(value, options, { date: false, time: true })
}

/** Date and time — `"9/2/26, 3:04 PM"`. */
export function dateTime(value: DateInput, options: DateOptions = {}): string {
  return formatDateParts(value, options, { date: true, time: true })
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
 * and trailing zero units but keep a zero between two non-zero ones (`"1h 00m 03s"`). `'long'`
 * labels through `Intl.NumberFormat` unit style (locale-aware) — `Intl.DurationFormat` is not in the
 * pinned TS lib. `null`/`undefined`/non-finite prints {@link NON_FINITE}; negatives clamp to zero.
 */
export function duration(
  seconds: number | null | undefined,
  options: DurationOptions = {},
): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return NON_FINITE
  const { style = 'clock', largest = 'hour', locale } = options
  if (style === 'clock') return durationClock(seconds)
  let rest = Math.max(0, Math.round(seconds))
  const first = DURATION_UNITS.findIndex(({ unit }) => unit === largest)
  const parts = DURATION_UNITS.slice(first).map(({ unit, short, seconds: size }) => {
    const value = Math.floor(rest / size)
    rest -= value * size
    return { unit, short, value }
  })
  const start = parts.findIndex(({ value }) => value > 0)
  if (start === -1) {
    return style === 'compact'
      ? '0s'
      : numberFormat(locale, { style: 'unit', unit: 'second', unitDisplay: 'long' }).format(0)
  }
  const end = parts.findLastIndex(({ value }) => value > 0)
  return parts
    .slice(start, end + 1)
    .map(({ unit, short, value }, i) =>
      style === 'compact'
        ? `${i === 0 ? value : String(value).padStart(2, '0')}${short}`
        : numberFormat(locale, { style: 'unit', unit, unitDisplay: 'long' }).format(value),
    )
    .join(' ')
}
