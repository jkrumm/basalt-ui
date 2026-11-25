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
    ceiling: 13, // v3 teardown-views: the rung, five kinds, `ChartCard`, `chartCursor`, `useChartFocus`, `chartLabels`; Issue 2306: `IntervalTrack`; Issue 3300: `Waterfall`, `RangeNavigator`
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
    // 132100 -> 134000 (Issue 2680): 133930 B measured, +~1.9 KB gz over the cap for the bar values kept at 390 and
    // the captions kept off bars and dots, the dots' sideways step, the chip dropped over a tick and the ink-step
    // bars' recede, the kit fixes of expression cycle 16.
    // 134000 -> 134200 (Issue 2696): 134090 B measured, +~90 B gz over the cap for the surface backing under an end
    // label another line runs through, a series the `endLabels` naming leaves no legend to name.
    // 134200 -> 134700 (Issue 2716): 134553 B measured, +~460 B gz over the cap for the card-colored backing under a value label a rule crosses, the clamp caret cut in the card's color on a bar, and the ink-step bars' stronger recede and rise, the kit fixes of expression cycle 17.
    // 134700 -> 135100 (Issue 2784): 135017 B measured, +~320 B gz over the cap for the stacked panes' shared y gutter, the tick rows a bar value keeps off and the focused band label that keeps its neighbours, the kit fixes of expression cycle 18.
    // 135100 -> 135300 (Issue 2784): 135262 B measured, +~160 B gz over the cap for the band label measured as the engine measures it (chip bold, tick regular) in place of a shrunk estimate that Linux Chrome's wider glyphs defeated.
    // 135300 -> 135400 (Issue 2889): 135349 B measured, +~90 B gz over master (135262) for the zone caption that slides along a zone full of bars (n96's aperture, ISO and shutter cards lost the caption their focal card kept).
    // 135400 -> 136800 (Issue 2828): 136702 B measured, +~1.25 KB gz over master (135349) for `y.scale: 'log'`: the log scale and decade ticks, the dev errors and the production skip, the decade-space label placement and the pixel maps in values.
    // 136800 -> 137600 (Issue 2882): 137464 B measured, +~760 B gz over master (136702) for the bar values raised over their bar with a leader or put beside an edge bar, the minimum height of a thin bar, the ink-step dim in the bar's own paint, the line value that names its series and the band chip's air, the kit fixes of expression cycle 19.
    // 137600 -> 139400 (Issue 2911): 139280 B measured, +~1.8 KB gz over master (137464) for the end-label gutter a
    // point scale keeps right of the last points (scale room, planner anchor, measured width), the ring and leader
    // of a page label in a crowded cloud with the plate under a label that lies over dots, and the Retry word read
    // from `home.retry` (the message table joins the chart closure).
    // 139400 -> 140400 (Issue 2883): 140242 B measured, +~1.0 KB gz over master (139280) for the segment value label (`valuesAt: 'segment'`)
    // placed inside its own segment of a stack, fitted like a clamped stack, and the stack-aware `y.domain` extent
    // (expression cycle 19 contract).
    // 140400 -> 140500 (trial 2 kit defects): 140476 B measured, +~80 B gz over master (140242) for the room under the longest negative bar that keeps its value label outside it (compile.ts roomForValues) and height 'fill' on Heatmap.
    // 140500 -> 141300 (Issue 3211): 141258 B measured, +~780 B gz over master (140476) for the phone's one inset: the y tick labels inside the plot, the edge anchor of an x label, `ChartCard bleed`, the end labels of the narrow class and the legend's coarse row gap.
    // 141300 -> 145500 (Issue 3300): 145418 B measured, +~3.9 KB gz over master (141258) for the rich tooltip (its
    // body, the change since the start or the day before, the reference reading, the status word, the followed
    // readout), the line colored by a second value with its gradient and ramp key, the log right axis, the dated
    // events with their rules, dots and tooltip rows (captions dropped on a phone), the named extremes kept inside the plot and the floating bar a waterfall stands on.
    ceiling: 145500,
    measure: () => measureSource(THREE_KIND),
  },
]

export const raises: Raises = {
  'chart-symbols': [
    {
      from: 11,
      to: 13,
      consumer:
        "`Waterfall` and `RangeNavigator` (Issue 3300, the owner's decision on the Issue): the /charts gallery draws a quarter's income bridge and a 13-year price history whose window the presets and the brush pick",
      repo: 'basalt-ui',
    },
    {
      from: 10,
      to: 11,
      consumer:
        "`IntervalTrack` (Issue 2306, owner review 1): n35 drew a calendar week's spans by hand on the seam track with fixed widths, raw colors and four waivers; the playground's /kit/interval-track draws the same week through the kind",
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
      from: 141300,
      to: 145500,
      consumer:
        "the owner's note on Issue 3300: the charts read 'very simple and cheap' beside a CBBI chart (a price on a log axis colored by its cycle score, halvings on the time axis, a window over 13 years) and a tooltip that names every series' change, reference and status; the /charts gallery draws each",
      repo: 'basalt-ui',
    },
    {
      from: 140500,
      to: 141300,
      consumer:
        "the owner's phone review of 2026-11-24 (Issue 3211): at 390 a chart lost 48 px to the page gutter, the card inset and the chart padding and about 44 px to the y axis; the plot takes the whole card content, a plot may run to the card edge, and lines that end apart are named at their ends",
      repo: 'basalt-ui',
    },
    {
      from: 140400,
      to: 140500,
      consumer:
        "a CBBI median-return bar chart whose most negative bar ended at the domain floor (trial 2 kit defects): its value stood inside the bar in dark ink while its neighbours' stood below theirs; the plot keeps the room under the longest negative bar, so every negative value stands below its end",
      repo: 'basalt-ui',
    },
    {
      from: 139400,
      to: 140400,
      consumer:
        "n97's unrated counts printed at the stack tops where they read as totals, and n93's 14-day fixture that drew a caret on every bar under a capping `y.domain` function (Issue 2883): a series of a stack labels its own segment with `valuesAt: 'segment'`, and a domain function reads the stack totals",
      repo: 'basalt-ui',
    },
    {
      from: 137600,
      to: 139400,
      consumer:
        "n79's end labels at 390 and n72's label over a dot in a dense cloud (Issue 2911): the end labels crossed the rising line at every spot, and the page label lay over the sure dot; the point scale keeps a gutter for the labels, a crowded label goes a ring away with a leader or onto a plate, and the Retry word reads `home.retry`",
      repo: 'basalt-ui',
    },
    {
      from: 136800,
      to: 137600,
      consumer:
        "n94's '+10 pts' inside its bar and its floating '+17 pts', n98's '+18%' struck at 390 and its dropped '+101%', and n96's 1-photo bucket drawn sub-pixel (Issue 2882): a bar value rises over its own bar with a leader or stands beside a bar that ends at the plot's edge, and a thin bar keeps a visible minimum",
      repo: 'basalt-ui',
    },
    {
      from: 135400,
      to: 136800,
      consumer:
        "The Bitcoin trial's price from $16 to $120,000 (Issue 2828, consumer trial FRICTION.md entry 7): on a linear y everything before 2020 is a flat line, and the builder's `log10` plot put the ticks on $63.1K and $39.8K; `y.scale: 'log'` takes decade ticks, zones and rules in data values and the named errors",
      repo: 'basalt-ui',
    },
    {
      from: 135300,
      to: 135400,
      consumer:
        "n96's four bar cards under one 1 % band (Issue 2889): the caption sat at the zone's start corner only, so the aperture, ISO and shutter cards, whose first bars are tall, drew none; it now slides along the zone to a gap",
      repo: 'basalt-ui',
    },
    {
      from: 134700,
      to: 135300,
      consumer:
        "n91's two panes whose x ticks stood 22 px apart, its bar value that read as one string with a y tick, and n89's four band labels that lost a different pair for every focus at 390 (Issue 2784): panes share the widest y gutter, a value label keeps off the tick rows and a focused band label, measured with the engine's own text measure (bold chip, regular tick, so the clearance holds on any font), drops no neighbour",
      repo: 'basalt-ui',
    },
    {
      from: 134200,
      to: 134700,
      consumer:
        "n82's '0' at Now under the typical-day rule and n84's 'US$1,832' under the 'No report' rule (Issue 2716): a value label a rule crosses sits on a card-colored backing, and the caret of a clamped bar is cut in the card's color",
      repo: 'basalt-ui',
    },
    {
      from: 134000,
      to: 134200,
      consumer:
        "n79's end labels struck by converging lines at 390 (Issue 2696): a series named only by its end label keeps it on a card-colored backing, as the text mark has no stroke",
      repo: 'basalt-ui',
    },
    {
      from: 132100,
      to: 134000,
      consumer:
        "the kit fixes of expression cycle 16 (Issue 2680): n76's hourly values and n70's '100 %' dropped at 390, n64's total lost under a caption, n72's dots solid and captioned over, and n80's x chip over its own tick",
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
