import { carried } from './define'

/** `Series.weight`: `quiet` or `strong` on the closed stroke scale, never a number. Carried by `toEngineSeries` (`WEIGHT_WIDTH`). */
export const weight = carried({
  id: 'weight',
  consumer:
    'argo features/strength-tracker/charts/training-load-chart.tsx:62 and weekly-volume-chart.tsx:93, strokeWidth (59 sites in 21 files)',
})
