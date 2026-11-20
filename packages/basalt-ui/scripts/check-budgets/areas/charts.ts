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
    // 122300 -> 123600 (Issue 2336): 123517 B measured, +~1.2 KB gz for the answer labels kept at 390, the
    // end labels cleared off the lines, whole-band zones, the zero stack's tick, the clamped bar's value
    // and the held span's end, the kit fixes of expression cycle 10.
    // 123600 -> 124500 (Issue 2410): 124405 B measured, +~890 B gz for `Series.spread`, the dot series'
    // least-move layout of coincident dots that `core/compile` carries for every cartesian kind.
    // 124500 -> 125600 (Issue 2409): 124666 B measured, +~1.1 KB gz for the readout that clears the ticks, the
    // clamped value's side placement and fill-matched ink, the rule claims for captions, and the interval
    // track's whole-or-dropped labels and minimum width, the kit fixes of expression cycle 11.
    // 125600 -> 126000 (Issue 2445): 125652 B measured, +~50 B gz over the cap for the dense-cloud label
    // placement, the held-focus release and the rule-aware zone caption, the kit fixes of expression cycle 12.
    // 126000 -> 127500 (Issue 2468): 127202 B measured, +~1.2 KB gz over the cap for the zone captions that
    // give way to page labels and keep clear of lines, the end-label leaders and the shared value-label pass
    // with its one caret per clamped value, the kit fixes of expression cycle 13.
    // 127500 -> 127800 (Issue 2486): 127548 B measured, +~50 B gz over the cap for the corner blanking and the
    // follower's empty x chip that clear the hover chips off the ticks they covered.
    // 127800 -> 128600 (Issue 2499): 128425 B measured, +~625 B gz over the cap for the rule caption's slide along
    // its rule, the x chip's hand-over to the panes of its own stack, the clamped value's free-row search, the
    // stack fitted to the clamp and the held run revealed whole, the kit fixes of expression cycle 14.
    // 128600 -> 128800 (Issue 2500): 128646 B measured, +~46 B gz over the cap for `x.tickFormat`, the tick
    // text apart from the readout's (expression cycle 14 contract).
    // 128800 -> 129000 (Issue 2573): 128904 B measured, +~104 B gz over the cap for the single-series stack's
    // inside value and the captions placed again around a value label that landed on one, the kit fixes of
    // expression cycle 15.
    // 129000 -> 132100 (Issue 2602): 131978 B measured, +~3.1 KB gz for the label-width table the engine now
    // measures its text with on the server and in the browser alike, so the server picture's gutters are the
    // hydrated ones (Astro matrix) and a late webfont no longer re-lays the plot.
    // 132100 -> 134200 (Issue 2680): 134098 B measured, +~2.0 KB gz over the cap for the bar values kept at 390 and
    // the captions kept off bars and dots, the dots' sideways step, the end labels dropped where a line strikes them,
    // the chip dropped over a tick and the ink-step bars' recede, the kit fixes of expression cycle 16.
    ceiling: 134200,
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
      from: 132100,
      to: 134200,
      consumer:
        "the kit fixes of expression cycle 16 (Issue 2680): n76's hourly values and n70's '100 %' dropped at 390, n64's total lost under a caption, n72's dots solid and captioned over, n79's end labels struck by lines, and n80's x chip over its own tick",
      repo: 'basalt-ui',
    },
    {
      from: 129000,
      to: 132100,
      consumer:
        "the Astro matrix (Issue 2602): every engine-drawn kind's static HTML differed from its hydrated picture (Lines 3.1%, Bars 13%, Heatmap 26% of pixels at 1440), its gutters sized from text the server estimated and the browser measured; the engine now measures with the label-width table on both sides, so the picture is the same to the pixel. The kinds' value labels keep their glyph estimate; an axis gutter from it would run wide on words",
      repo: 'basalt-ui',
    },
    {
      from: 128800,
      to: 129000,
      consumer:
        "the kit fixes of expression cycle 15 (Issue 2573): n70's negative bar and n71's tallest bar lost their values, and n68's tallest value label sat over its zone caption",
      repo: 'basalt-ui',
    },
    {
      from: 128600,
      to: 128800,
      consumer:
        'the expression cycle 14 contract (Issue 2500, Spec artifact_01a1f6fb): n66 printed reading times as clock times and n63, n64 and n67 hand-built short date ticks, so an x axis takes ticks apart from its readout',
      repo: 'basalt-ui',
    },
    {
      from: 127800,
      to: 128600,
      consumer:
        "the kit fixes of expression cycle 14 (Issue 2499): n63's rule caption sat on a dense line, n64's stack total sat inside its stack and its clamped stack lost the upper segments, n67's x chip covered its date ticks, and n61's held run showed one row of seven",
      repo: 'basalt-ui',
    },
    {
      from: 127500,
      to: 127800,
      consumer:
        "the hover chips that still covered a painted tick label (Issue 2486): n46's y chip over its first date tick, n15's x chip over the lowest time tick, and the x chip drawn on every panel of /charts and /recipes/two-pane",
      repo: 'basalt-ui',
    },
    {
      from: 126000,
      to: 127500,
      consumer:
        "the kit fixes of expression cycle 13 (Issue 2468): n57's, n59's and n62's zone captions were struck by lines or sat over another zone, n59's vault label lost to the 'Limit' caption, n58's end labels floated far from their lines, and n58's and n62's clamped values printed twice or with another hour's number",
      repo: 'basalt-ui',
    },
    {
      from: 125600,
      to: 126000,
      consumer:
        "the kit fixes of expression cycle 12 (Issue 2445): n55's labels in a dense dot cloud were dropped or hung far from their dot, the shared focus dropped in the gap between two cards, and n46's zone caption was struck by a rule",
      repo: 'basalt-ui',
    },
    {
      from: 124500,
      to: 125600,
      consumer:
        "the kit fixes of expression cycle 11 (Issue 2409): n49's and n50's hover readout sat on a tick label, n50's and n46's clamped values sat on the caret, a gridline or a zone caption and vanished on a dimmed bar, n45's rule and zone captions stacked and crossed rules, and n47's span labels ended in an ellipsis",
      repo: 'basalt-ui',
    },
    {
      from: 123600,
      to: 124500,
      consumer:
        "coincident dots of expression cycle 11 (Issue 2410): n45's containers at equal memory peaks merged into one dot and n49's hundred fresh pages heaped on the baseline; a dot series now takes `spread: 'x' | 'y'`",
      repo: 'basalt-ui',
    },
    {
      from: 122300,
      to: 123600,
      consumer:
        "the kit fixes of expression cycle 10 (Issue 2336): n41's and n44's extreme-bar labels, n40's 'Today' rule and n39's run labels dropped at 390, n40's and n42's end labels sat on lines, n41's and n44's band zones drew short or nothing, n41's zero stack showed no position, n44's clamped bar no value and n39's held span ended an hour short",
      repo: 'basalt-ui',
    },
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
