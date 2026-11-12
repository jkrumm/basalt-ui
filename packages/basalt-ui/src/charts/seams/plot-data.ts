import { planar } from './define'

/** `plot.data`: every datum, whatever the legend hides, for bucket-level marks. Carried by `customPlot`. */
export const plotData = planar({
  id: 'plot.data',
  consumer:
    'linewatch web/src/charts/latency-band-chart.tsx:434-435, absent and full-loss columns read the slot grid off `plot.data`, which no legend toggle empties',
})
