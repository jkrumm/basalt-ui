/**
 * `basalt-ui/format` — Mantine-free, React-free `Intl`-backed formatting. One implementation for
 * numbers/percentages/money, dates/times/durations and the two measurement units argo needed
 * (`km`/`kcal`) — replacing argo's `features/*\/{formatters,formulas,format}.ts` (~350 of 643
 * lines across four duration spellings) and the chart layer's own `charts/utils/format.ts`, which
 * now re-exports from here.
 *
 * Every formatter takes `(value, opts?)`; `locale` on every `opts` defaults to `undefined` —
 * `Intl`'s own "use the runtime's locale". Every non-finite/unparseable input prints the same
 * {@link NON_FINITE} em dash rather than `"NaN"` or throwing.
 *
 * @example
 * import { money, percent, duration, weekday, relativeTime } from 'basalt-ui/format'
 *
 * money(1234, { currency: 'USD' })        // "$1,234"
 * percent(0.42)                            // "42%"
 * duration(3_723)                          // "1h 02m"
 * weekday('2026-09-02')                    // "Wed"
 * relativeTime(Date.now() - 3_600_000)     // "1 hour ago"
 */
export {
  compact,
  deltaPct,
  type DeltaPctOptions,
  fmtCompact,
  type FmtCompactOptions,
  fmtCurrency,
  type FmtCurrencyOptions,
  fmtInt,
  fmtPercent,
  type FmtPercentOptions,
  integer,
  type LocaleOption,
  money,
  NON_FINITE,
  percent,
} from './number'
export {
  clock,
  type ClockOptions,
  duration,
  durationClock,
  type DurationOptions,
  type DurationUnit,
  fmtAxisDate,
  fmtTooltipDate,
  relativeTime,
  type RelativeTimeOptions,
  weekday,
  type WeekdayOptions,
} from './date'
export { kcal, type KcalOptions, km, type KmOptions } from './measure'

import { fmtCompact, fmtCurrency, fmtInt, fmtPercent } from './number'
import { fmtAxisDate, fmtTooltipDate } from './date'

/**
 * Every shipped chart-facing formatter under one name, so a chart can be handed the whole set
 * (`format={formatters.compact}`). Unchanged shape from `charts/utils/format.ts` — this is the
 * SAME object, not a second one, so an existing `formatters.x` call site keeps working verbatim.
 */
export const formatters = {
  compact: fmtCompact,
  percent: fmtPercent,
  currency: fmtCurrency,
  int: fmtInt,
  axisDate: fmtAxisDate,
  tooltipDate: fmtTooltipDate,
} as const
