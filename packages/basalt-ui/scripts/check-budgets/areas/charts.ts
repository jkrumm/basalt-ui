/**
 * Area: charts — the `./charts` subpath's size (docs/V2-SPEC.md § 9). Chart byte rows land here.
 */
import { CHART_SUBPATH } from '../../surface-gates'
import { readSurface } from '../lib'
import type { Raises, RowDef } from '../lib'
import { measureSource, reExportNamed } from '../ui-bundle'

/** The G1 byte fixtures (gzip B minus `base0`, peers bundled, `../ui-bundle`); seeds are the first build +5%, up to 0.5 KB, ratcheted down only. */
const SPARKLINE = reExportNamed('charts/parts/sparkline', ['Sparkline'])
/** `charts-three-kind`: the fixture v3-freeze-g4's marginal rows (Heatmap, BandStrip) subtract against. */
const THREE_KIND = [
  SPARKLINE,
  reExportNamed('charts/parts/lines', ['Lines']),
  reExportNamed('charts/parts/bars', ['Bars']),
].join('\n')

export const rows: readonly RowDef[] = [
  {
    id: 'chart-symbols',
    order: 20,
    label: 'public value symbols, ./charts (export-surface shards)',
    // 2.0 target 48.
    ceiling: 11, // v3 teardown-views: the rung, five kinds, `ChartCard`, `chartCursor`, `useChartFocus`, `chartLabels`; Issue 2306: `IntervalTrack`
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
    // 120524 B measured. Informative target 46.5 KB, and + 4 KB per further kind: not pins.
    // 121500 -> 121800 (Issue 2039): 121562 B measured, +~60 B gz over the cap for the edge slide, the rule
    // caption's step and leader and the clamped value label, the kit fixes of expression cycle 9.
    // 121800 -> 122300 (Issue 2281): 122159 B measured, +~360 B gz for the hover's axis-pinned x and y
    // labels, the card legend that toggles and isolates, and the list reveal that never scrolls the page.
    ceiling: 122300,
    measure: () => measureSource(THREE_KIND),
  },
]

export const raises: Raises = {
  'chart-symbols': [
    {
      from: 10,
      to: 11,
      consumer:
        "`IntervalTrack` (Issue 2306, owner review 1): n35 drew a calendar week's spans by hand on the seam track with fixed widths, raw colours and four waivers; the playground's /kit/interval-track draws the same week through the kind",
      repo: 'basalt-ui',
    },
    {
      from: 14,
      to: 16,
      consumer:
        '`useChartFocus` and `chartLabels`, the geometry seam (Issue 1019): weatherorb meteogram.tsx dims the rest around a focused hour and drives its readout; weatherorb timeline-bar.tsx measures tick labels by hand to pick a stride',
      repo: 'weatherorb',
    },
  ],
  'charts-three-kind': [
    {
      from: 121800,
      to: 122300,
      consumer:
        "owner review 1 (Issue 2281): /cards' sparkline read only y, c12's card legend could not toggle a model, and n04's plot jumped under the pointer; every cartesian hover now pins x and y on the axes and a ChartCard legend toggles and isolates",
      repo: 'basalt-ui',
    },
    {
      from: 121500,
      to: 121800,
      consumer:
        "the label kit fixes of expression cycle 9 (Issue 2039): n38's top-item label dropped at 390 and its clamped item drew no value, n34's rule captions sat on the series lines, and n35 hand-placed row labels by its narrowest track",
      repo: 'basalt-ui',
    },
    {
      from: 117500,
      to: 121500,
      consumer:
        "the bar value labels, accent highlight, zero-bar tick and clamped stack of expression cycle 8 (Issue 1980): n28 placed its mover's and zeros' labels by hand with chartLabels and split one series in two for the accent, n31 placed its day totals by hand, cycle 7's n22 and n24 their end and total labels; the labels place with a glyph estimate, not the 8 KB width table",
      repo: 'basalt-ui',
    },
  ],
}
