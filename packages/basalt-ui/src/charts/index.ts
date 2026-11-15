/**
 * `basalt-ui/charts` — the chart layer on TanStack Charts (`docs/v3/concepts/charts-cards-kanban.md`).
 * Mantine-free: the rung (`CartesianChart`), the kinds (`Lines`, `Bars`, `Sparkline`,
 * `Heatmap`, `BandStrip`), the card (`ChartCard`), the shared cursor (`chartCursor`) and the geometry seam (`useChartFocus`, `chartLabels`). Engine marks for
 * `CartesianChart`'s `marks` are imported from the allowed `@tanstack/charts/*` subpaths directly;
 * tokens come from `basalt-ui/tokens`, formatters from `basalt-ui/format`. Nothing here re-exports
 * either, or the engine.
 */
export { CartesianChart } from './parts/cartesian'
export { Lines, type LinesProps, type LineSeries } from './parts/lines'
export { Bars, type BarsProps, type BarsSeries } from './parts/bars'
export { Sparkline } from './parts/sparkline'
export {
  BandStrip,
  type BandStripProps,
  type BandStripSeries,
  type BandSpan,
  type BandFold,
} from './parts/band-strip'
export { Heatmap, type HeatmapProps, type HeatmapState } from './parts/heatmap'
export { ChartCard } from './parts/chart-card'
export { chartCursor } from './core/cursor'
export {
  useChartFocus,
  type ChartFocus,
  type ChartFocusGroupItem,
  type ChartFocusItem,
  type ChartFocusOptions,
  type ChartFocusTarget,
} from './focus'
export {
  chartLabels,
  type ChartLabel,
  type LabelBox,
  type LabelSpot,
  type LabelWeight,
  type PlacedLabel,
} from './chart-labels'
export type {
  PlacedRowLabel,
  RowLabel,
  RowSpot,
  TrackAxis,
  TrackAxisOptions,
  TrackProps,
  TrackRow,
  TrackRowOptions,
  TrackTick,
  TrackValue,
} from './track'
export type {
  CartesianChartProps,
  CardAction,
  ChartCardProps,
  ChartFigure,
  ChartPlot,
  ChartRefLine,
  ChartSelection,
  ChartTooltipConfig,
  ChartZone,
  CurveName,
  CustomMarks,
  Empty,
  Fact,
  FootFacts,
  FrameHead,
  FrameState,
  LegendEntry,
  Marker,
  Series,
  SeriesBase,
  SeriesColor,
  SparklineProps,
  SparkPoint,
  XConfig,
  YConfig,
} from './contract'
