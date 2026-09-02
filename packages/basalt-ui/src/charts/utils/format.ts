/**
 * Re-export shim. The implementation moved to `basalt-ui/format` (C5 consolidation, so
 * `money`/`percent`/`duration`/`clock`/… and the chart formatters share one implementation
 * instead of two). This file stays so every existing relative import inside `src/charts/**`
 * (`../utils/format`) keeps resolving unchanged.
 */
export {
  fmtAxisDate,
  fmtTooltipDate,
  fmtCompact,
  type FmtCompactOptions,
  fmtPercent,
  type FmtPercentOptions,
  fmtCurrency,
  type FmtCurrencyOptions,
  fmtInt,
  formatters,
  NON_FINITE,
} from '../../format'
