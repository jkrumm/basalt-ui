---
source: basalt-ui
description: Charts on the shipped host — a chart kind or CartesianChart, inside a ChartCard.
paths:
  - '**/src/**'
---

# Basalt Charts

Every chart is a shipped kind or `CartesianChart`; props live in the shipped types.

## Composition

- Use a shipped kind when one fits; otherwise compose `CartesianChart` with custom marks. [type:CartesianChartProps] [type:CustomMarks]
- `label` is required on every chart. [type:CartesianChartProps]
- Custom marks return engine marks (a `text` mark included, placed by `chartLabels`) from a `ChartPlot` and nothing else; margins, scales, axes, grid, cursor, legend and tooltip are the host's. [type:ChartPlot]
- Supply `series` once; a legend entry with no series is a `LegendEntry`, never a fake series. [type:LegendEntry]
- Wrap a chart in `ChartCard`; its headline figure and period are the `figure`, not a filler `subtitle`. [type:ChartCardProps]
- A pending, failed or empty query is `FrameState`, never `data ?? []`; a Suspense fallback is the same card with `phase: 'loading'`. [type:FrameState]
- A chart's `useChartFocus` is built over the array the chart draws; a list of a subset maps its rows to that focus by id. [type:ChartFocus]
- The threshold that defines the answer is drawn as a zone or reference line, never only stated in a footer. [type:ChartZone] [type:ChartRefLine]
- Extra tooltip rows are data, never markup. [type:ChartTooltipConfig]
- A card footer holds at most two facts. [type:FootFacts]

## Boundaries

- Draw chart marks through a chart kind or the `useChartFocus` seam from `basalt-ui/charts`; never hand-built marks outside it or a chart body outside a card. [lint:primitive-bypass]
- Import chart code from `basalt-ui/charts`; the engine package, visx and the engine's react entry are banned. [lint:import-boundary]
- A series colour is a `{ light, dark }` pair from the app's series file; write no colour literal in a chart file. [type:SeriesColor] [lint:colour-literal]
- A chart card never receives `data ?? []` as a fallback. [lint:data-primitive]

not guarded:

- Draw `plot.rows(key)` and `plot.visible`, never the `series` prop, so a legend toggle hides the mark; a size in a mark reads `plot.plotHeight`.
- Date text on a time axis comes from `useFormat` or `createFormat`, never a raw `Intl` call.
- The hero, the marks and the baseline measure one quantity; the figure's delta and status follow focus through `focus.readout`, which takes any value.
- Charts share one cursor by default; a chart that must not share isolates itself with a cursor group.
