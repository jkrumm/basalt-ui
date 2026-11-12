import { carried } from './define'

/** `Series.gaps: 'connect'`: draw through the non-null points; absent still breaks by default. Carried by `toEngineSeries`. */
export const gaps = carried({
  id: 'gaps',
  consumer:
    'argo features/strength-tracker/charts/one-rm-trend-chart.tsx:49, a lift that is null on most shared dates is one line (10 sites)',
})
