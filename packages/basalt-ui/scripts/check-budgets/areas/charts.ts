/**
 * Area: charts — the `./charts` subpath's size (docs/V2-SPEC.md § 9). Chart byte rows land here.
 */
import { CHART_SUBPATH } from '../../surface-gates'
import { readSurface } from '../lib'
import type { Raise, RowDef } from '../lib'
import { measureSource, reExportNamed } from '../ui-bundle'

/** The G1 byte fixtures (gzip B minus `base0`, peers bundled, `../ui-bundle`); seeds are the first build +5%, up to 0.5 KB, ratcheted down only. */
const SPARKLINE = reExportNamed('charts/Sparkline', ['Sparkline'])
/** `charts-three-kind`: the fixture v3-freeze-g4's marginal rows (Heatmap, BandStrip) subtract against. */
const THREE_KIND = [
  SPARKLINE,
  reExportNamed('charts/Lines', ['Lines']),
  reExportNamed('charts/Bars', ['Bars']),
].join('\n')

export const rows: readonly RowDef[] = [
  {
    id: 'chart-symbols',
    order: 20,
    label: 'public value symbols, ./charts (export-surface shards)',
    // 2.0 target 48.
    ceiling: 16, // landed (W5): the rung, nine kinds, `ChartCard`, `chartCursor`, `chartCurve` (argo friction row 27); +`foldBands` (linewatch band/throughput strip tests, ledger row 80); +`useChartFocus`, `chartLabels` (the geometry seam, Issue 1019; v3 allocation 10 -> 12 by owner verdict)
    measure: () => readSurface()[CHART_SUBPATH]?.length ?? 0,
  },
  {
    id: 'charts-sparkline',
    order: 21,
    label: 'charts Sparkline (gzip B minus base0, src/charts, peers bundled)',
    // 63330 B measured. Informative target 32.5 KB (engine floor, gap-perf 6.1), not a pin: the 2.x
    // chart closure is still in src/charts; the seed is the measurement and only ratchets down.
    ceiling: 66500,
    measure: () => measureSource(SPARKLINE),
  },
  {
    id: 'charts-three-kind',
    order: 22,
    label: 'charts Sparkline + Lines + Bars (gzip B minus base0, src/charts, peers bundled)',
    // 111790 B measured. Informative target 46.5 KB, and + 4 KB per further kind: not pins.
    ceiling: 117500,
    measure: () => measureSource(THREE_KIND),
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
