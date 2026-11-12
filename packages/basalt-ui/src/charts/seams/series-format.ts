import { carried } from './define'

/** `Series.format`: one value formatter per series, read by the legend and the tooltip row. Carried by `toEngineSeries` (`formatValue`). */
export const format = carried({
  id: 'format',
  consumer:
    'argo features/strength-tracker/charts/training-load-chart.tsx:64, formatValue(v, d) reads the datum (66 sites in 34 files)',
})
