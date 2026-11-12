// Row ids of the series codemods. Fixed here; the migration rows (v3-charts-7c) write one row per id.
// They follow the report shape and the row-id rule of ../report.ts: a flag id is never counted as rewritten.

/** Rows the codemod rewrites. */
export const SERIES_REWRITE_ROWS = [
  'sf-format',
  'sf-weight',
  'sf-dash',
  'sf-axis',
  'sf-opacity',
  'stacked-area',
  'chart-marks',
  'meter-zones',
  'bars-1x',
] as const

/**
 * Rows the codemod only flags. `series-review` is the worklist of a rewrite row that could not be
 * applied mechanically at one site (a stroke width between 1.5 and 2, an expression where a literal
 * is needed, a conflict with a v3 field); its reason starts with the rewrite row it belongs to, and
 * the site is left untouched.
 */
export const SERIES_FLAG_ROWS = [
  'sf-auto-domain',
  'statstrip-statcell',
  'deltabadge-polarity',
  'donut',
  'mirrored-bars',
  'dual-panel',
  'chart-curve',
  'fold-bands',
  'series-review',
] as const
