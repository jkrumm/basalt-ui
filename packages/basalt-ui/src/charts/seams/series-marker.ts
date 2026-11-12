import { carried } from './define'

/** `Series.getMarker`: a per-datum marker colour on the cursor dot; `null` for none. Carried by `toEngineSeries`. */
export const getMarker = carried({
  id: 'getMarker',
  consumer:
    "linewatch web/src/charts/latency-band-chart.tsx:254, the hover dot takes the bucket's worst-loss colour (argo weight-chart.tsx:60, skinfold-chart.tsx:69)",
})
