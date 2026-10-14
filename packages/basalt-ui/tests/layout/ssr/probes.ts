/** The `[data-probe]` names `ssr/app.tsx` renders, in page order. Pure data: the test imports it. */
export const ROW_COUNT = 8

export const CHART_PROBES = [
  'lines',
  'lines-no-legend',
  'bars',
  'stacked-area',
  'sparkline',
  'band-strip',
  'donut',
  'heatmap',
  'heatmap-fill',
  'dual-panel',
  'mirrored-bars',
  'cartesian-chart',
  'lines-fixed-height',
  'lines-responsive-height',
  'card-header-legend',
  'card-kpi',
  'card-short-chart',
  'card-loaded',
  'card-fallback',
  'lines-pending',
] as const
const TABLE_PROBES = ['table-loaded', 'table-fallback'] as const
export const PROBES = [...CHART_PROBES, ...TABLE_PROBES] as const
