import { carried } from './define'

/** A lone point: a line series with one finite point (or an isolated one between gaps) draws its dot. Carried by `loneDots` in `lineMarks`. */
export const lonePoint = carried({
  id: 'lone point',
  consumer:
    'argo features/strength-tracker/charts/one-rm-trend-chart.tsx:49, a lift logged once in the window (ledger row 107)',
})
