/**
 * Area: charts — the `./charts` subpath's size (docs/V2-SPEC.md § 9). Chart byte rows land here.
 */
import { CHART_SUBPATH } from '../../surface-gates'
import { readSurface } from '../lib'
import type { Raise, RowDef } from '../lib'

export const rows: readonly RowDef[] = [
  {
    id: 'chart-symbols',
    order: 20,
    label: 'public value symbols, ./charts (export-surface shards)',
    // 2.0 target 48.
    ceiling: 16, // landed (W5): the rung, nine kinds, `ChartCard`, `chartCursor`, `chartCurve` (argo friction row 27); +`foldBands` (linewatch band/throughput strip tests, ledger row 80); +`useChartFocus`, `chartLabels` (the geometry seam, Issue 1019; v3 allocation 10 -> 12 by owner verdict)
    measure: () => readSurface()[CHART_SUBPATH]?.length ?? 0,
  },
]

export const raises: readonly Raise[] = [
  {
    ceiling: 'chart-symbols',
    from: 14,
    to: 16,
    consumer:
      '`useChartFocus` and `chartLabels`, the geometry seam (Issue 1019): weatherorb meteogram.tsx dims the rest around a focused hour and drives its readout; weatherorb timeline-bar.tsx measures tick labels by hand to pick a stride',
    repo: 'weatherorb',
  },
]
