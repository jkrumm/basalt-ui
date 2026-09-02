/**
 * Date/time/duration formatting. `fmtAxisDate`/`fmtTooltipDate` moved here from
 * `src/charts/utils/format.ts` (C5 consolidation) — that file now re-exports from this module.
 * The rest (`clock`/`weekday`/`relativeTime`/`duration`/`durationClock`) are new, seeded from argo
 * consumers (`features/{walking-pad,reading,astro-window,garmin-health}/{formatters,format,
 * formulas}.ts` — read those files' own JSDoc for the exact call sites this generalizes).
 */
import { dateFormat, NON_FINITE, toDate } from './shared'
import type { LocaleOption } from './shared'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Axis-friendly short date: DD.MM. A non-finite or invalid date prints {@link NON_FINITE}. */
export function fmtAxisDate(value: unknown): string {
  if (typeof value === 'number' && !Number.isFinite(value)) return NON_FINITE
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return NON_FINITE
    const dd = String(value.getDate()).padStart(2, '0')
    const mm = String(value.getMonth() + 1).padStart(2, '0')
    return `${dd}.${mm}`
  }
  const s = String(value ?? '')
  const match = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (match) return `${match[3]}.${match[2]}`
  return s
}

/** Tooltip-friendly long date: "Mon Apr 21 2026". A non-finite or invalid date prints
 * {@link NON_FINITE}. */
export function fmtTooltipDate(date: unknown): string {
  if (typeof date === 'number' && !Number.isFinite(date)) return NON_FINITE
  if (date instanceof Date) {
    if (Number.isNaN(date.getTime())) return NON_FINITE
    return `${SHORT_DAYS[date.getDay()]} ${MONTHS[date.getMonth()]} ${date.getDate()} ${date.getFullYear()}`
  }
  const s = String(date ?? '')
  const match = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return s
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return `${SHORT_DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()} ${d.getFullYear()}`
}

export type ClockOptions = LocaleOption & {
  /** IANA zone (`'Europe/Vienna'`). Default the runtime's own zone — the same "local" argo's
   * `d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })` call sites meant. */
  timeZone?: string
  /** Render `:ss` too. Default false. */
  seconds?: boolean
}

/** A local clock reading — `"09:41"`. Seeds: `m365-explorer/explorer-page.tsx`,
 * `walking-pad/session-history.tsx` (both `toLocaleTimeString([...], { hour: '2-digit', minute:
 * '2-digit' })`). A non-finite/unparseable input prints {@link NON_FINITE}. */
export function clock(value: Date | number | string, options: ClockOptions = {}): string {
  const date = toDate(value)
  if (date === null) return NON_FINITE
  const { locale, timeZone, seconds = false } = options
  return dateFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    ...(seconds && { second: '2-digit' }),
    hour12: false,
    ...(timeZone !== undefined && { timeZone }),
  }).format(date)
}

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

function relativeTimeFormat(locale: string | undefined): Intl.RelativeTimeFormat {
  const key = locale ?? ''
  const cached = relativeTimeFormatterCache.get(key)
  if (cached !== undefined) return cached
  const created = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  relativeTimeFormatterCache.set(key, created)
  return created
}

/**
 * Short relative phrase — `"3 hours ago"`, `"in 2 days"`, `"just now"`. Seeded from
 * `agent-chat/relative-time.ts#formatRelativeTime` (epoch-ms, 'en'-hardcoded), generalized with a
 * `locale` option and accepting `Date`/ISO-string inputs too (argo's
 * `reading/format.ts#relativeTime` and `garmin-health/formulas.ts#formatRelativeTime` both take an
 * ISO string). A non-finite/unparseable input prints {@link NON_FINITE} rather than throwing —
 * `Intl.RelativeTimeFormat.format` throws a `RangeError` on non-finite input, and this is
 * render-path code where one bad timestamp must not blank a whole list.
 */
export function relativeTime(
  value: number | Date | string,
  options: RelativeTimeOptions = {},
): string {
  const { locale, now = Date.now() } = options
  const timestamp =
    value instanceof Date ? value.getTime() : typeof value === 'number' ? value : Date.parse(value)
  if (!Number.isFinite(timestamp)) return NON_FINITE
  const diffMs = timestamp - now
  const absMs = Math.abs(diffMs)
  if (absMs < 60_000) return 'just now'
  const unit = RELATIVE_TIME_UNITS.find(({ ms }) => absMs >= ms) ?? RELATIVE_TIME_UNITS.at(-1)!
  return relativeTimeFormat(locale).format(Math.round(diffMs / unit.ms), unit.unit)
}

export type DurationUnit = 'seconds' | 'minutes'

export type DurationOptions = {
  /** Unit of the input value. Default `'seconds'`. */
  unit?: DurationUnit
}

/**
 * Human duration — `"1h 02m"`, `"5m"`, `"42s"`. Minutes zero-pad once an hour is present (`"1h
 * 02m"`, a clock-reading convention); alone they don't (`"5m"`). Seconds show only under a minute
 * (`"42s"`). A non-finite value prints {@link NON_FINITE}.
 *
 * The one signature standing in for argo's four duration spellings: `walking-pad/
 * formatters.ts#formatDuration` (seconds, `<60s` → `"Ns"` — this IS that shape),
 * `reading/format.ts#formatReadTime` (seconds, no `<60s` branch, floors at `"0m"` — pass a value
 * `>= 60` and the shapes match), `astro-window/formulas.ts#fmtMinutes` (minutes as input — pass
 * `{ unit: 'minutes' }`). The fourth, `walking-pad/formatters.ts#formatDurationClock` (`h:mm:ss`),
 * is {@link durationClock} below, not this.
 */
export function duration(value: number, options: DurationOptions = {}): string {
  if (!Number.isFinite(value)) return NON_FINITE
  const { unit = 'seconds' } = options
  const totalSeconds = Math.max(0, Math.round(unit === 'minutes' ? value * 60 : value))
  if (totalSeconds < 60) return `${totalSeconds}s`
  const totalMinutes = Math.round(totalSeconds / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m}m`
  return `${h}h ${String(m).padStart(2, '0')}m`
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
