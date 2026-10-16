/**
 * `basalt-ui/format` — Mantine-free, React-free `Intl`-backed formatting. One implementation for
 * numbers/percentages/money, dates/times/durations and the two measurement units argo needed
 * (`km`/`kcal`) — replacing argo's `features/*\/{formatters,formulas,format}.ts` (~350 of 643
 * lines across four duration spellings) and the 1.x chart layer's own formatters (2.0's charts
 * import the internals directly).
 *
 * Every formatter takes `(value, opts?)`; `locale` on every `opts` defaults to what `defineFormat`
 * (or `BasaltProvider`'s `locale` / `timeZone` props) set, else `undefined` — `Intl`'s own "use the
 * runtime's locale". Number formatters accept `null | undefined`. Every non-finite/unparseable input prints the same
 * {@link NON_FINITE} em dash rather than `"NaN"` or throwing.
 *
 * @example
 * import { money, percent, durationClock, weekday, relativeTime } from 'basalt-ui/format'
 *
 * money(1234, { currency: 'USD' })        // "$1,234"
 * percent(0.42)                            // "42%"
 * durationClock(3_723)                    // "1:02:03"
 * weekday('2026-09-02')                    // "Wed"
 * relativeTime(Date.now() - 3_600_000)     // "1 hour ago"
 */
export { bytes, compact, delta, integer, money, percent } from './number'
export { durationClock, relativeTime, weekday } from './date'
export { kcal, km } from './measure'
export { defineFormat } from './shared'
