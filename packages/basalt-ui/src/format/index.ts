/**
 * `basalt-ui/format` — Mantine-free, React-free `Intl`-backed formatting: numbers, percentages,
 * money, bytes and signed deltas, dates and durations, and the two measurement units argo needed
 * (`km`/`kcal`).
 *
 * Every formatter takes `(value, opts?)`. `locale` defaults to what `defineFormat` (or
 * the provider's locale and time zone props) set, else the runtime's locale. That default is
 * ONE value per process; pass `locale` per call to override it. Number formatters accept
 * `null | undefined`, and every non-finite/unparseable input prints the same {@link NON_FINITE}
 * em dash rather than `"NaN"` or throwing.
 *
 * @example
 * import { money, percent, durationClock, weekday, relativeTime } from 'basalt-ui/format'
 *
 * money(1234, { currency: 'USD' })        // "$1,234.00"
 * percent(0.42)                            // "42%"
 * durationClock(3_723)                    // "1:02:03"
 * weekday('2026-09-02')                    // "Wed"
 * relativeTime(Date.now() - 3_600_000)     // "1 hour ago"
 */
export { bytes, compact, delta, integer, money, percent } from './number'
export { date, dateTime, duration, durationClock, relativeTime, time, weekday } from './date'
export { kcal, km } from './measure'
export { defineFormat } from './shared'
