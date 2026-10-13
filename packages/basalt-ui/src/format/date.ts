/**
 * Date/time/duration formatting (`clock`/`weekday`/`relativeTime`/`duration`/`durationClock`),
 * seeded from argo consumers (`features/{walking-pad,reading,astro-window,garmin-health}/{formatters,format,
 * formulas}.ts` — read those files' own JSDoc for the exact call sites this generalizes).
 */
import { dateFormat, NON_FINITE, toDate } from './shared'
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
