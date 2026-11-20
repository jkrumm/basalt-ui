/**
 * `Format`: the one place a number, a date or a duration becomes text.
 *
 * `createFormat({ locale, timeZone })` is pure and holds its `Intl` instances in its own closure, so
 * nothing is shared between a server request and the next one. The default is `en` and `UTC`, never
 * the runtime's: the host locale and zone differ between the server and the browser, and a formatter
 * that reads them prints a different string on each side (a hydration mismatch). `'host'` is the
 * explicit opt-in to the runtime zone. No code here reads `navigator`.
 *
 * `useFormat()` reads the provider's locale and time zone (`provider-props`) and builds the instance
 * lazily, so a provider that never formats never loads this module.
 */
import { useMemo } from 'react'
import { useProviderContext } from './provider'
import { useIntl } from './provider-props'

export type { BasaltMessages } from './messages'

/** What every formatter prints for input it cannot represent: `NaN`, `±Infinity`, an invalid date. */
export const NON_FINITE = '—'

/** A zone-less `YYYY-MM-DD`. Never display `new Date('YYYY-MM-DD')`: it is a UTC instant that shifts a day west of UTC. */
export type CalendarDate = `${number}-${number}-${number}`

/** A message: a literal, or a function of the formatter and its arguments. */
export type Msg<A extends unknown[] = []> = string | ((f: Format, ...a: A) => string)

/** `short` `Sep 2, 2026`, `long` `September 2, 2026`, `month` `September 2026`, `weekday` `Wed`, `day` `Sep 2` (a day and month, no year). */
export type DateStyle = 'short' | 'long' | 'month' | 'weekday' | 'day'

/** `clock` `1:02:03`; `words` the two largest units in the locale's short names: `12 hr 30 min`. */
export type DurationStyle = 'clock' | 'words'

export interface Format {
  /** Grouped number in the locale. Non-finite prints an em dash. */
  number(n: number, o?: Intl.NumberFormatOptions): string
  /** A fraction as a percentage: `0.42` is `42%`. */
  percent(fraction: number, o?: Intl.NumberFormatOptions): string
  /** Money. The currency is required: there is no default. */
  money(n: number, currency: string, o?: Intl.NumberFormatOptions): string
  /** A `CalendarDate` prints that day in UTC; a `Date` or epoch ms prints in `o.timeZone`, else the format's zone. */
  date(v: Date | number | CalendarDate, style?: DateStyle, o?: Intl.DateTimeFormatOptions): string
  dateTime(v: Date | number, style?: 'short' | 'long', o?: Intl.DateTimeFormatOptions): string
  time(v: Date | number, o?: Intl.DateTimeFormatOptions): string
  /** `"3 hours ago"`. Pass `now` wherever the output must match between server and client. */
  relative(v: Date | number, now?: Date | number): string
  /**
   * A span in milliseconds. `clock` (default): `"1:02:03"`, `"04:12"`. `words`: the two largest
   * units in the locale's short unit names, rounded at the smaller one: `"12 hr 30 min"`, `"2 days 4 hr"`, `"45 sec"`.
   */
  duration(ms: number, style?: DurationStyle): string
  plural(n: number): Intl.LDMLPluralRule
}

export type FormatOptions = {
  /** BCP 47 tag. Default `en`. */
  locale?: string | undefined
  /** IANA zone. Default `UTC`; `'host'` is the runtime's own zone. */
  timeZone?: string | undefined
}

const DEFAULT_LOCALE = 'en'
const DEFAULT_ZONE = 'UTC'
const DEFAULT_STYLE = 'short'
const SIGN: Intl.NumberFormatOptions = { signDisplay: 'negative' }

const DATE_STYLES: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: 'numeric', month: 'short', year: 'numeric' },
  long: { day: 'numeric', month: 'long', year: 'numeric' },
  month: { month: 'long', year: 'numeric' },
  weekday: { weekday: 'short' },
  day: { day: 'numeric', month: 'short' },
}

const DATE_TIME_STYLES: Record<'short' | 'long', Intl.DateTimeFormatOptions> = {
  short: { ...DATE_STYLES.short, hour: 'numeric', minute: '2-digit' },
  long: { ...DATE_STYLES.long, hour: 'numeric', minute: '2-digit', second: '2-digit' },
}

const TIME_STYLE: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' }

/** Largest first: the units a worded duration names, in seconds. */
const DURATION_UNITS: readonly {
  readonly unit: 'day' | 'hour' | 'minute' | 'second'
  readonly s: number
}[] = [
  { unit: 'day', s: 86_400 },
  { unit: 'hour', s: 3_600 },
  { unit: 'minute', s: 60 },
  { unit: 'second', s: 1 },
]

/**
 * The two largest non-zero units of `total` seconds, rounded at the smaller one: 12:29:51 is 12 h
 * 30 min, 59 min 50 s is 1 h. The second unit is left out when it rounds to zero.
 */
function durationParts(
  total: number,
): readonly { unit: (typeof DURATION_UNITS)[number]['unit']; n: number }[] {
  const index = DURATION_UNITS.findIndex(({ s }) => total >= s)
  const big = DURATION_UNITS[index]
  if (big === undefined) return [{ unit: 'second', n: 0 }]
  const small = DURATION_UNITS[index + 1]
  if (small === undefined) return [{ unit: big.unit, n: total }]
  const rounded = Math.round(total / small.s) * small.s
  const larger = DURATION_UNITS[index - 1]
  if (larger !== undefined && rounded >= larger.s) return durationParts(rounded)
  const n = Math.floor(rounded / big.s)
  const rest = Math.round((rounded - n * big.s) / small.s)
  return rest === 0
    ? [{ unit: big.unit, n }]
    : [
        { unit: big.unit, n },
        { unit: small.unit, n: rest },
      ]
}

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

/** Midnight UTC of a real `YYYY-MM-DD`, else `null`. `setUTCFullYear` keeps years 0-99 out of 19xx. */
function parseCalendarDate(value: string): Date | null {
  const match = CALENDAR_DATE.exec(value)
  if (match === null) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const result = new Date(0)
  result.setUTCFullYear(year, month, day)
  const real =
    result.getUTCFullYear() === year &&
    result.getUTCMonth() === month &&
    result.getUTCDate() === day
  return real ? result : null
}

/** Largest first. The count is rounded before the unit is chosen, so 59.6 minutes reads `1 hour`. */
const RELATIVE_UNITS: readonly {
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

/** ICU writes September `Sept` in en-GB and kin, `Sep` in en-US: one short form across English. */
const shortSeptember = (text: string): string => text.replace(/\bSept\b/g, 'Sep')

function toInstant(v: Date | number): Date | null {
  const date = v instanceof Date ? v : new Date(v)
  return Number.isFinite(date.getTime()) ? date : null
}

/**
 * A pure formatter for one locale and time zone. Default `en` and `UTC`, never the host's; `timeZone: 'host'` opts in to the runtime zone.
 * Its `Intl` instances live in the returned object, so nothing is shared between requests.
 *
 * @useWhen code outside React needs formatted text (a model module, a server function, a chart label builder)
 * @neverWhen a component can call `useFormat`, which reads the provider's locale and time zone
 */
export function createFormat(o: FormatOptions = {}): Format {
  const locale = o.locale ?? DEFAULT_LOCALE
  const zone = o.timeZone === 'host' ? undefined : (o.timeZone ?? DEFAULT_ZONE)
  const english = locale.toLowerCase().startsWith('en')

  const numbers = new Map<string, Intl.NumberFormat>()
  const dates = new Map<string, Intl.DateTimeFormat>()
  let relatives: Intl.RelativeTimeFormat | undefined
  let plurals: Intl.PluralRules | undefined

  const numberFormat = (options: Intl.NumberFormatOptions): Intl.NumberFormat => {
    const key = JSON.stringify(options)
    let cached = numbers.get(key)
    if (cached === undefined) {
      cached = new Intl.NumberFormat(locale, options)
      numbers.set(key, cached)
    }
    return cached
  }

  const dateFormat = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
    const key = JSON.stringify(options)
    let cached = dates.get(key)
    if (cached === undefined) {
      cached = new Intl.DateTimeFormat(locale, options)
      dates.set(key, cached)
    }
    return cached
  }

  const formatDate = (date: Date, options: Intl.DateTimeFormatOptions): string => {
    const text = dateFormat({ timeZone: zone, ...options }).format(date)
    return english ? shortSeptember(text) : text
  }

  return {
    number: (n, options) =>
      Number.isFinite(n) ? numberFormat({ ...SIGN, ...options }).format(n) : NON_FINITE,

    percent: (fraction, options) =>
      Number.isFinite(fraction)
        ? numberFormat({ ...SIGN, ...options, style: 'percent' }).format(fraction)
        : NON_FINITE,

    money: (n, currency, options) =>
      Number.isFinite(n)
        ? numberFormat({ ...SIGN, ...options, style: 'currency', currency }).format(n)
        : NON_FINITE,

    date: (v, style, options) => {
      const preset = DATE_STYLES[style ?? DEFAULT_STYLE]
      if (typeof v === 'string') {
        const day = parseCalendarDate(v)
        return day === null
          ? NON_FINITE
          : formatDate(day, { ...preset, ...options, timeZone: 'UTC' })
      }
      const instant = toInstant(v)
      return instant === null ? NON_FINITE : formatDate(instant, { ...preset, ...options })
    },

    dateTime: (v, style, options) => {
      const preset = DATE_TIME_STYLES[style ?? DEFAULT_STYLE]
      const instant = toInstant(v)
      return instant === null ? NON_FINITE : formatDate(instant, { ...preset, ...options })
    },

    time: (v, options) => {
      const instant = toInstant(v)
      return instant === null ? NON_FINITE : formatDate(instant, { ...TIME_STYLE, ...options })
    },

    relative: (v, now = Date.now()) => {
      const instant = toInstant(v)
      const reference = toInstant(now instanceof Date ? now : new Date(now))
      if (instant === null || reference === null) return NON_FINITE
      relatives ??= new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'long' })
      const diff = instant.getTime() - reference.getTime()
      const magnitude = Math.abs(diff)
      const index = RELATIVE_UNITS.findIndex(({ ms }) => magnitude >= ms)
      const picked = RELATIVE_UNITS[index]
      if (picked === undefined) return relatives.format(diff < 0 ? -0 : 0, 'second')
      const larger = RELATIVE_UNITS[index - 1]
      const unit =
        larger !== undefined && Math.round(magnitude / picked.ms) * picked.ms >= larger.ms
          ? larger
          : picked
      return relatives.format((diff < 0 ? -1 : 1) * Math.round(magnitude / unit.ms), unit.unit)
    },

    duration: (ms, style) => {
      if (!Number.isFinite(ms)) return NON_FINITE
      const total = Math.max(0, Math.round(ms / 1000))
      if (style === 'words') {
        return durationParts(total)
          .map(({ unit, n }) =>
            numberFormat({ style: 'unit', unit, unitDisplay: 'short' }).format(n),
          )
          .join(' ')
      }
      const hours = Math.floor(total / 3600)
      const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
      const seconds = String(total % 60).padStart(2, '0')
      return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`
    },

    plural: (n) => {
      plurals ??= new Intl.PluralRules(locale)
      return plurals.select(n)
    },
  }
}

/** One instance per locale and zone for the whole tree: every `useFormat()` shares the same `Intl` caches. */
const shared = new Map<string, Format>()

function sharedFormat(locale: string | undefined, timeZone: string | undefined): Format {
  const key = `${locale ?? ''}|${timeZone ?? ''}`
  let format = shared.get(key)
  if (format === undefined) {
    format = createFormat({ locale, timeZone })
    shared.set(key, format)
  }
  return format
}

/**
 * The formatter for the current locale and time zone: the provider's `locale` and `timeZone` props,
 * else English and UTC. Built on first use, not when the provider mounts.
 *
 * @useWhen a component prints a number, date, money amount, relative time or duration for a reader
 * @neverWhen the code runs outside React (a model module, a server function): use `createFormat`
 *
 * @example
 * const f = useFormat()
 * f.duration(45_000_000, 'words') // '12 hr 30 min', not the clock's '12:30:00'
 * f.date(day, 'day') // 'Nov 12': a day and month, no year
 * f.date(day) // 'Nov 12, 2026'
 */
export function useFormat(): Format {
  const intl = useIntl()
  const providerLocale = useProviderContext().locale
  const locale = intl.locale ?? providerLocale
  const timeZone = intl.timeZone
  return useMemo(() => sharedFormat(locale, timeZone), [locale, timeZone])
}
