# 2.0 chart inventory

Input to `docs/V2-SPEC.md` § 9. Two tables: every chart a basalt-ui consumer renders, mapped to its
2.0 kind, and every 1.x `basalt-ui/charts` export mapped to its 2.0 fate. Read-only Explore pass over
`~/SourceRoot` on 2026-10-13 (argo on 1.36.0, linewatch 1.41.0, weatherorb 1.30.2).

## Consumer charts

One row per chart call site (a JSX element that renders a chart; a component rendered several times,
like linewatch's latency band ×5, is one row). **59 production charts** in 3 repos — argo 40,
linewatch 11, weatherorb 8 — plus 3 on argo's dev-only smoke route (marked "(dev)"), 62 rows in all.
argo's two HTML visualisations (`strength-tracker/charts/alignment-matrix-chart.tsx:81`,
`strength-ratios-chart.tsx:63`) are Mantine layout, not charts, and are not counted. rb, rollhook, basalt-ui-obsidian, email-gateway and image-gateway render no
basalt chart: rollhook's one chart is recharts, rb only lists `@visx/*` in `optimizeDeps`. modelpick
(not a basalt consumer) runs a vendored fork of the 1.x layer and is out of scope.

Shared by every cartesian row unless noted: the shared cursor (no consumer uses `ChartCursorScope`),
a categorical x over date/ISO string keys (2.0: `Date`, so `x` becomes proportional), and a
`ChartCard` wrapper. **leading** = `cursorResolution="leading"`. **ext-legend** = `legend={false}`
plus a separate `ChartLegend` (2.0: `legend.placement: 'header'`). **rows** = `tooltip.label` /
`prependRows` / `extraRows` built from `TooltipRow` (2.0: `tooltip.rows` data).

### argo (`apps/dashboard/src/features/…`)

| #   | File:line                                                  | 1.x                                                   | 2.0              | 2.0 must support                                                                                        |
| --- | ---------------------------------------------------------- | ----------------------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| a1  | usage-tracking/charts/billing-split.tsx:34                 | Donut                                                 | `Donut`          | `centerLabel`/`centerSubLabel`, `colorForKey`, `formatValue`                                            |
| a2  | usage-tracking/charts/cache-hit-ratio.tsx:70               | ZonedLine                                             | `Lines`          | 2 zones, fixed y [0,1], leading, ext-legend                                                             |
| a3  | usage-tracking/charts/cost-over-time.tsx:55                | StackedArea                                           | `StackedArea`    | dynamic group keys + color fn, `y.format`, leading                                                      |
| a4  | usage-tracking/charts/error-rate.tsx:54                    | StackedArea                                           | `StackedArea`    | per-source stack, leading                                                                               |
| a5  | usage-tracking/charts/latency-p95.tsx:56                   | ZonedLine                                             | `Lines`          | `y.autoMinCeil`, leading                                                                                |
| a6  | usage-tracking/charts/tokens-over-time.tsx:54              | StackedArea                                           | `StackedArea`    | as #3                                                                                                   |
| a7  | walking-pad/charts/daily-activity-chart.tsx:175            | Bars                                                  | `Bars`           | grouped/stacked/normalised, dashed line on `y2`, rows using `hidden`                                    |
| a8  | walking-pad/charts/length-histogram-chart.tsx:125          | Bars                                                  | `Bars`           | string buckets (`scaleBand`), tick stride, header format, no legend                                     |
| a9  | walking-pad/charts/pace-trend-chart.tsx:98                 | ZonedLine                                             | `Lines`          | 4 zones with ±∞ bounds (clamped), legend-only reference entry, legend groups                            |
| a10 | walking-pad/charts/sparkline-grid-chart.tsx:100            | LineSparkline (one call site in a `.map`, ×6 tiles)   | `Sparkline`      | inside `StatCard` `sparkline` slot, size from the card                                                  |
| a11 | walking-pad/charts/time-of-day-chart.tsx:119               | bespoke `<svg>` + `ChartTooltipFloat`                 | `Heatmap`        | day × hour cells, gradient legend, custom rows, `matchHeight`                                           |
| a12 | walking-pad/charts/weekly-volume-chart.tsx:156             | Bars                                                  | `Bars`           | grouped/stacked/normalised, rows, leading                                                               |
| a13 | garmin-health/charts/activities-chart.tsx:208              | Bars                                                  | `Bars`           | dynamic stacked keys, rows badge + per-activity rows                                                    |
| a14 | garmin-health/charts/activity-score-chart.tsx:161          | Bars                                                  | `Bars`           | 3 stacked + dashed MA line, zone ≥600, dashed ref line, rows                                            |
| a15 | garmin-health/charts/acwr-chart.tsx:86                     | ZonedLine                                             | `Lines`          | zone, **thresholds** above and below, 3 ref lines, zone badge, ext-legend                               |
| a16 | garmin-health/charts/body-battery-chart.tsx:70             | Bars                                                  | `Bars`           | positive + negative bars, net line, `autoPad`/floors                                                    |
| a17 | garmin-health/charts/divergence-chart.tsx:114              | DualPanel                                             | `DualPanel`      | top 2 lines + fill-between (`differenceY`), bottom ± bars, `topFraction` 0.7                            |
| a18 | garmin-health/charts/fitness-trends-chart.tsx:236          | CartesianChart + `LinePath`, circles                  | `CartesianChart` | `lineY` ×2 + `dot` markers, y [−2.5, 2.5], ref 0, legend highlight                                      |
| a19 | garmin-health/charts/recovery-trend-chart.tsx:85           | ZonedLine                                             | `Lines`          | 3 zones, fixed y, badge, ext-legend                                                                     |
| a20 | garmin-health/charts/sleep-breakdown-chart.tsx:116         | Bars                                                  | `Bars`           | stacked + negative bar, score line on `y2` [0,100], zone, rows                                          |
| a21 | garmin-health/charts/stress-chart.tsx:134                  | CartesianChart + `Threshold`, gradient, `LinePath` ×2 | `Lines`          | `area` gradient + thresholds, dashed 2nd line, 3 ref lines, badge                                       |
| a22 | strength-tracker/charts/inol-chart.tsx:192                 | CartesianChart + `LinePath` ×2, circles               | `CartesianChart` | 5 zones, 3 ref lines, per-point marker colour, legend-only zone entries, rows                           |
| a23 | strength-tracker/charts/momentum-chart.tsx:188             | DualPanel                                             | `DualPanel`      | top line + dashed MA with markers, bottom ± bars, `bottomMaxAbsFloor`                                   |
| a24 | strength-tracker/charts/one-rm-trend-chart.tsx:238         | MultiLine                                             | `Lines`          | child MA series (`parent`, no legend/tooltip), PR markers, domain fn                                    |
| a25 | strength-tracker/charts/readiness-strain-chart.tsx:87      | ZonedLine                                             | `Lines`          | 3 zones, 2 ref lines, badge + rows, legend highlight                                                    |
| a26 | strength-tracker/charts/relative-progression-chart.tsx:142 | CartesianChart + `LinePath`                           | `Lines`          | symmetric ± domain fn, ref 0, legend highlight                                                          |
| a27 | strength-tracker/charts/sparkline-grid-chart.tsx:82        | LineSparkline                                         | `Sparkline`      | 80×28 in a table row                                                                                    |
| a28 | strength-tracker/charts/sparkline-grid-chart.tsx:91        | BarSparkline                                          | `Sparkline`      | 80×28, `mark: 'bar'`                                                                                    |
| a29 | strength-tracker/charts/sparkline-grid-chart.tsx:100       | LineSparkline                                         | `Sparkline`      | 80×28                                                                                                   |
| a30 | strength-tracker/charts/strength-composite-chart.tsx:242   | CartesianChart + `LinePath` ×3                        | `Lines`          | zone band, ref 0, y [−3,3] with 7 ticks, rows                                                           |
| a31 | strength-tracker/charts/training-load-chart.tsx:200        | CartesianChart + `LinePath`                           | `Lines`          | 4 zones, 4 ref lines, legend-only zone entries, leading                                                 |
| a32 | strength-tracker/charts/weekly-volume-chart.tsx:108        | Bars                                                  | `Bars`           | 4 stacked + `barOpacity` fn, dashed MA, ref lines with legend, leading                                  |
| a33 | body-composition/charts/weight-chart.tsx:184               | MultiLine                                             | `Lines`          | markers, overlay MA, constant reference series, fixed domain                                            |
| a34 | body-composition/charts/skinfold-chart.tsx:123             | CartesianChart + `AreaClosed`, `LinePath`, circles    | `Lines`          | per-series `area`, average line, markers                                                                |
| a35 | astro-window/charts/cloud-layers-chart.tsx:94              | CartesianChart + `LinePath`                           | `Lines`          | ISO-hour x, dashes, series `note`, `formatHeader`, `tooltip.onFollow`                                   |
| a36 | astro-window/charts/monthly-budget-chart.tsx:86            | Bars                                                  | `Bars`           | grouped, string months                                                                                  |
| a37 | astro-window/charts/night-timeline-chart.tsx:143           | CartesianChart + `LinePath`, `Line`, rect             | `CartesianChart` | x-zones (edge), `cursorValue`, `rect` + `ruleX` annotations, horizon rule                               |
| a38 | astro-window/charts/sky-panorama.tsx:325                   | ChartFrame + hand-rolled plot (waiver)                | `CartesianChart` | **numeric x** (azimuth), `areaY`, `rect` glow cells, `lineY`, `dot`; `tooltip={false}`; the waiver goes |
| a39 | astro-window/components/scout-panel.tsx:175                | LineSparkline                                         | `Sparkline`      | 240×40                                                                                                  |
| a40 | agents/hero-stats.tsx:30                                   | LineSparkline (one call site, 2 tiles)                | `Sparkline`      | `StatCard` slot                                                                                         |
| a41 | routes/charts-smoke.tsx:85 (dev)                           | LineSparkline                                         | `Sparkline`      | dev-only smoke route                                                                                    |
| a42 | routes/charts-smoke.tsx:97 (dev)                           | ZonedLine                                             | `Lines`          | dev-only smoke route                                                                                    |
| a43 | routes/charts-smoke.tsx:118 (dev)                          | MultiLine                                             | `Lines`          | dev-only smoke route                                                                                    |

### linewatch (`web/src/…`)

l1, l3, l4, l6, l7 and l8 set `tooltip.onFollow` (kept in 2.0, V2-SPEC § 9.4). Together with a35
that is 7 of 59 production charts showing a tooltip while they follow. Every row with a query sets
`isPending` (2.0: `state`).

| #   | File:line                                                  | 1.x                                                   | 2.0              | 2.0 must support                                                                                                             |
| --- | ---------------------------------------------------------- | ----------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| l1  | charts/availability-strip.tsx:308                          | BandStrip                                             | `BandStrip`      | state fills with per-column alpha, `fold`, absent hatch, top margin 0, rows                                                  |
| l2  | charts/availability-heatmap.tsx:149                        | ChartFrame + bespoke `CategoryGrid`                   | `Heatmap`        | absent hatch, absolute intensity, gradient legend, per-cell rows, no cursor                                                  |
| l3  | charts/latency-band-chart.tsx:355 (×5 in routes/index.tsx) | CartesianChart + `LinePath`, **`@visx/shape` `Area`** | `CartesianChart` | `areaY` p5–p95 (y1/y2), hatch + down-band `rect`s, `lineY` ×3, loss `dot`s, legend-only entries; the direct visx import goes |
| l4  | charts/speed-chart.tsx:141                                 | MultiLine                                             | `Lines`          | 2 lines, dynamic dashed ref lines labelled by reference entries, compact height                                              |
| l5  | charts/speed-heatmap.tsx:166                               | ChartFrame + `CategoryGrid`                           | `Heatmap`        | measured/failed/absent states, 30-day clamp                                                                                  |
| l6  | charts/bufferbloat-chart.tsx:77                            | MultiLine                                             | `Lines`          | 3 lines (2 dashed), height `{ base: 190, wide: 260 }`                                                                        |
| l7  | charts/throughput-chart.tsx:200                            | MirroredBars                                          | `MirroredBars`   | per-pane domains, absent fraction hatch, opacity fn, `fold`, top margin 0                                                    |
| l8  | charts/link-speed-strip.tsx:325                            | BandStrip                                             | `BandStrip`      | intensity fill, transition `marker`, `fold`                                                                                  |
| l9  | components/status-bar.tsx:372                              | BarSparkline                                          | `Sparkline`      | loss, pooled max, `mark: 'bar'`; the host measures the width                                                                 |
| l10 | components/status-bar.tsx:395                              | LineSparkline                                         | `Sparkline`      | RTT                                                                                                                          |
| l11 | components/status-bar.tsx:416                              | LineSparkline                                         | `Sparkline`      | download                                                                                                                     |

### weatherorb (`apps/web/src/map/point/…`)

| #   | File:line                           | 1.x                                                 | 2.0              | 2.0 must support                                                           |
| --- | ----------------------------------- | --------------------------------------------------- | ---------------- | -------------------------------------------------------------------------- |
| w1  | meteogram.tsx:324 (Temperature row) | CartesianChart + raw `<path>`, `LinePath`, `<line>` | `CartesianChart` | `areaY` p10–p90 ribbon, model `lineY`s, median segments coloured per value |
| w2  | meteogram.tsx:465 (Precipitation)   | CartesianChart + `Bar`, whisker lines               | `CartesianChart` | `barY` per hour + `tickY` p90 whiskers                                     |
| w3  | meteogram.tsx:561 (Cloud)           | CartesianChart + `AreaClosed`, `LinePath`           | `CartesianChart` | `areaY` + `lineY`                                                          |
| w4  | meteogram.tsx:662 (Wind)            | CartesianChart + `LinePath`, arrow glyphs           | `CartesianChart` | `lineY` + `vector` direction glyphs                                        |
| w5  | report-charts.tsx:119 (Altitude)    | CartesianChart + `LinePath`                         | `CartesianChart` | ref lines 0 and 8° (dashed)                                                |
| w6  | report-charts.tsx:182 (Cloud)       | CartesianChart + raw spread `<path>`                | `CartesianChart` | `areaY` spread band, y [0,100]                                             |
| w7  | report-charts.tsx:249 (Surf wave)   | CartesianChart + stepped paths                      | `CartesianChart` | **`y2` right axis**, step curve                                            |
| w8  | report-charts.tsx:271 (Surf wind)   | CartesianChart + tick glyphs                        | `CartesianChart` | `vector` direction ticks                                                   |

All 8 share: night x-zones (`align: 'edge'`), `smartTicks` x values (2.0: `xTicks`), legend groups
with `maxRows`, compact heights, and a cursor synced to the map timeline through `globalCursorStore`
/ `useCursorState` (2.0: `chartCursor()` + `useSyncExternalStore`).

### Totals

| 2.0                                                  | Charts          | From                                                                 |
| ---------------------------------------------------- | --------------- | -------------------------------------------------------------------- |
| `CartesianChart` (consumer `marks`)                  | 13              | argo 4, linewatch 1, weatherorb 8                                    |
| `Lines`                                              | 16 (+2 dev)     | ZonedLine 6, MultiLine 4, hand-composed line-only `CartesianChart` 6 |
| `Bars`                                               | 9               | Bars 9                                                               |
| `Sparkline`                                          | 9 (+1 dev)      | LineSparkline 7, BarSparkline 2                                      |
| `StackedArea`                                        | 3               | StackedArea 3                                                        |
| `Heatmap`                                            | 3               | bespoke grids 3 (the 1.x kind has 0 uses)                            |
| `DualPanel` / `BandStrip` / `MirroredBars` / `Donut` | 2 / 2 / 1 / 1   | same kind                                                            |
| **Total**                                            | **59** (+3 dev) |                                                                      |

No consumer uses a log scale, brush/zoom, chart click handlers or `ChartCursorScope`. Bands and
ribbons (4 charts in 2 repos) are one `areaY` with `y1`/`y2`, a mark, not a kind.

## 1.x `basalt-ui/charts` → 2.0

97 values (`packages/basalt-ui/scripts/export-surface.json`, key `./charts`, which records values
only) and 69 types (the type exports of `packages/basalt-ui/src/charts/index.ts`). Every row lands in `MIGRATING.md` § 2.0.
"Consumer `marks`" = import the mark inside `CartesianChart`'s `marks`, from the subpath named in the
cell. Every specifier below is on the V2-SPEC § 9.8 allowlist (the bare `@tanstack/charts` root is
banned). basalt re-exports nothing from the engine.

### Raw visx re-exports (23, all deleted)

| 1.x                                                                                                                | 2.0 replacement                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `LinePath`                                                                                                         | `lineY` (`@tanstack/charts/line`) in consumer `marks`, or a `Lines` series                                              |
| `AreaClosed`                                                                                                       | `areaY` (`@tanstack/charts/area`) in consumer `marks`, or `ChartSeries.area`                                            |
| `AreaStack`                                                                                                        | `StackedArea`, or `areaY` + `stack` (`@tanstack/charts/stack`)                                                          |
| `Threshold`                                                                                                        | `Lines` `thresholds`, or `differenceY` (`@tanstack/charts/difference`)                                                  |
| `Bar`, `BarStack`, `BarGroup`                                                                                      | `Bars`, or `barY` (`@tanstack/charts/bar`, + `stack`)                                                                   |
| `Line`                                                                                                             | `ruleX` / `ruleY` (`@tanstack/charts/rule`), `link` (`@tanstack/charts/link`), or `refLines`                            |
| `Pie`                                                                                                              | `Donut`                                                                                                                 |
| `Group`                                                                                                            | deleted: marks carry their own position                                                                                 |
| `GridRows`, `GridColumns`                                                                                          | deleted: `AxisConfig.grid`                                                                                              |
| `scaleLinear`, `scaleBand`, `scalePoint`, `scaleTime`                                                              | deleted: the x scale follows `x`'s value type; `@tanstack/charts/scales/*` or `d3-scale` (basalt's peer) inside `marks` |
| `curveMonotoneX`, `curveLinear`, `curveCatmullRom`, `curveStep`, `curveStepAfter`, `curveStepBefore`, `curveBasis` | `ChartSeries.curve`; `d3Curve` from `@tanstack/charts/d3/shape` inside `marks`                                          |

### Kinds

| 1.x                                                                        | 2.0                                                                           |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `ZonedLine`, `ZonedLineProps`, `ZonedLineThreshold`, `ZonedLineRefLine`    | `Lines`, `LinesProps`, `Threshold`, `RefLine`                                 |
| `MultiLine`, `MultiLineProps`                                              | `Lines`, `LinesProps`                                                         |
| `Bars`, `BarsProps`, `BarsBar`, `BarsLine`, `BarsRefLine`                  | `Bars`, `BarsProps`, `BarsBar`, `BarsLine`, `RefLine`                         |
| `StackedArea`, `StackedAreaProps`                                          | kept                                                                          |
| `DualPanel`, `DualPanelProps`                                              | kept (compiled through `composeViews`)                                        |
| `MirroredBars`, `MirroredBarsProps`, `MirroredBarPane`                     | kept (`composeViews`)                                                         |
| `BandStrip`, `BandStripProps`, `BandStripSeries`, `BandSpan`               | kept                                                                          |
| `Donut`, `DonutProps`, `DonutDatum`                                        | kept (`polar`)                                                                |
| `Heatmap`, `HeatmapProps`                                                  | kept, rebuilt on `cell`; deleted in W5 unless it replaces the 3 bespoke grids |
| `LineSparkline`, `BarSparkline`, `LineSparklineProps`, `BarSparklineProps` | `Sparkline`, `SparklineProps` (`mark: 'line' \| 'bar'`)                       |

### Rung, frame, cursor, tooltip, legend

| 1.x                                                                                                                    | 2.0                                                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `CartesianChart`, `CartesianChartProps`, `AxisConfig`, `PlotContext`                                                   | kept names, new contract (V2-SPEC § 9.2); `children(ctx)` → `marks(plot)`                  |
| `resolveAxisDomain`                                                                                                    | internal                                                                                   |
| `ChartFrame`, `ChartFrameProps`, `ChartFrameLegend`, `PlotRect`, `resolveLegend`                                       | deleted: the host is private; bespoke bodies move to `CartesianChart` or `Heatmap`         |
| `ResponsiveChartHeight`                                                                                                | kept                                                                                       |
| `ChartState`                                                                                                           | kept; `isPending` alias deleted                                                            |
| `ChartCenter`, `ChartPending`, `ChartEmpty`, `ChartError`, their 4 `…Props`, `ResolvedChartState`, `resolveChartState` | internal to the host and `ChartCard`                                                       |
| `ChartCard`, `ChartCardProps`, `ChartCardSlot`                                                                         | kept                                                                                       |
| `ChartCursorScope`, `ChartCursorScopeProps`                                                                            | `cursorGroup` prop                                                                         |
| `globalCursorStore`, `createCursorStore`, `CursorStore`, `CursorState`, `useCursorState`                               | `chartCursor(group?)` → TanStack `ChartCursorController`; read with `useSyncExternalStore` |
| `useChartCursor`, `ChartCursor`, `CursorAnchor`, `DomainKind`                                                          | deleted: TanStack focus + basalt resolution                                                |
| `CursorResolution`                                                                                                     | kept (`'exact' \| 'nearest' \| 'leading'`)                                                 |
| `Crosshair`, `SeriesDot`, `HoverOverlay`                                                                               | deleted: TanStack `crosshair`, focus ring, keyboard focus                                  |
| `AxisBottomDate`, `AxisBottomNumeric`, `AxisLeftNumeric`, `AxisRightNumeric`                                           | deleted: TanStack guides                                                                   |
| `ZoneRects`, `XZoneRects`                                                                                              | deleted; `ZoneSpec`, `XZoneSpec` kept as prop types                                        |
| `AreaGradient`, `areaFillUrl`                                                                                          | `ChartSeries.area`                                                                         |
| `HatchPattern`, `hatchFill`, `hatchSizeFor`                                                                            | deleted; absent-state paint is a V2-SPEC § 9 Open item (hatch)                             |
| `ChartTooltipFloat`, `TooltipHeader`, `TooltipRow`, `TooltipBody`                                                      | deleted: TanStack tooltip surface; rows are `ChartTooltipRow` data                         |
| `CartesianTooltipConfig`, `CartesianTooltipRowContext`, `BandTooltipConfig`, `BandTooltipRowContext`                   | `ChartTooltipConfig` (one type for every kind)                                             |
| `ChartLegend`, `LegendEntry`, `deriveLegend`, `deriveTooltipRows`                                                      | internal; ext-legend → `legend.placement: 'header'`                                        |
| `ChartLegendConfig`                                                                                                    | kept; `LegendPlacement` inlined                                                            |
| `ChartSeries`                                                                                                          | kept, absorbs `SeriesStyle` (+ `area`)                                                     |
| `SeriesStyle`, `SeriesMark`, `SeriesDash`, `SeriesCurve`, `SeriesRole`                                                 | folded into `ChartSeries` (`ChartSeries['curve']`, …)                                      |
| `curveFor`                                                                                                             | internal                                                                                   |
| `foldBands`                                                                                                            | internal (tests only); `BandFold` kept                                                     |
| `useChartSize`, `UseChartSizeResult`, `ChartSize`                                                                      | deleted: the host measures                                                                 |

### Layout, ticks, formatting, tokens

| 1.x                                                                                                                                                                | 2.0                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| `autoMargin`, `probeAxisLabels`, `AutoMarginInput`, `measureText`, `maxTextWidth`                                                                                  | deleted: TanStack measured guides                                    |
| `smartTicks`, `smartTicksEvery`, `xLabelPxFor`, `autoXLabelRotate`                                                                                                 | deleted: `xTicks` (count or values) + `tickLabels.thin`; no rotation |
| `chartMargin`, `ChartMargin`                                                                                                                                       | deleted: margins are measured; band kinds own their top inset        |
| `fmtAxisDate`, `fmtTooltipDate`, `fmtCompact`, `fmtPercent`, `fmtCurrency`, `fmtInt`, `formatters`, `FmtCompactOptions`, `FmtPercentOptions`, `FmtCurrencyOptions` | `./format` only (one home)                                           |
| `VX`, `alpha`, `buildPaletteCss`, `seriesTokens`, `defineSeries`, `groupTokens`, `ColorPair`, `SeriesMap`, `SeriesKey`                                             | `./tokens` only (`SeriesKey` also on `.`)                            |
| `VxThemeProvider`, `useVxTheme`, `VxTheme`                                                                                                                         | deleted: every chart paint is a `var(--vx-*)` reference              |

2.0 `./charts` (draft, § 1 owns the final count): 12 values (`CartesianChart`, `Lines`, `Bars`,
`StackedArea`, `DualPanel`, `MirroredBars`, `BandStrip`, `Donut`, `Heatmap`, `Sparkline`,
`ChartCard`, `chartCursor`) and about 30 types, from 166 names.
