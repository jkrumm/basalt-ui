/**
 * Area: charts — the `./charts` subpath's size (docs/V2-SPEC.md § 9). Chart byte rows land here.
 */
import { CHART_SUBPATH } from '../../surface-gates'
import { readSurface } from '../lib'
import type { RowDef } from '../lib'

export const rows: readonly RowDef[] = [
  {
    id: 'chart-symbols',
    order: 20,
    label: 'public value symbols, ./charts (export-surface.json)',
    // 2.0 target 48.
    ceiling: 14, // landed (W5): the rung, nine kinds, `ChartCard`, `chartCursor`, `chartCurve` (argo friction row 27); +`foldBands` (linewatch band/throughput strip tests, ledger row 80)
    measure: () => readSurface()[CHART_SUBPATH]?.length ?? 0,
  },
]
