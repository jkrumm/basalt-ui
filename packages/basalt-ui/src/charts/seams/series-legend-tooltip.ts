import { carried } from './define'

/** `Series.legend: false` and `Series.tooltip: false`: keep a series out of the legend or out of the tooltip rows. Carried by `toEngineSeries`. */
export const legendTooltipFalse = carried({
  id: 'legend and tooltip false',
  consumer:
    'argo features/strength-tracker/charts/one-rm-trend-chart.tsx:66-67, a companion line with neither entry nor row (legend 11 sites, tooltip 8)',
})
