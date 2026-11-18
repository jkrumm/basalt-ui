/**
 * `basalt-ui/charts` — the chart layer on TanStack Charts (`docs/v3/concepts/charts-cards-kanban.md`).
 * The rung (`CartesianChart`), the kinds (`Lines`, `Bars`, `Sparkline`,
 * `Heatmap`, `BandStrip`), the card (`ChartCard`), the shared cursor (`chartCursor`) and the geometry seam (`useChartFocus`, `chartLabels`). Engine marks for
 * `CartesianChart`'s `marks` are imported from the allowed `@tanstack/charts/*` subpaths directly;
 * tokens come from `basalt-ui/tokens`, formatters from the root `basalt-ui` entry. Nothing here re-exports
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
export {
  IntervalTrack,
  type IntervalSeries,
  type IntervalTrackProps,
  type IntervalX,
} from './parts/interval-track'
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
  ChartCardProps,
  ChartFigure,
  ChartPlot,
  ChartRefLine,
  ChartSelection,
  ChartTooltipConfig,
  ChartZone,
  CurveName,
  CustomMarks,
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

// The frame's value types live on `basalt-ui/cards`; these eight stay one minor as aliases of the
// same types (migration rows `charts-frame-types-*` in `migrations/areas/charts.json`).
import type {
  CardAction as CardsCardAction,
  Empty as CardsEmpty,
  Fact as CardsFact,
  FootFacts as CardsFootFacts,
  FrameHead as CardsFrameHead,
  FrameState as CardsFrameState,
  CardMenu as CardsMenu,
  MenuEntry as CardsMenuEntry,
} from '../core/phase'

/** @deprecated Import `CardAction` from `basalt-ui/cards`; this alias is removed in the next minor. */
export type CardAction = CardsCardAction
/** @deprecated Import `Empty` from `basalt-ui/cards`; this alias is removed in the next minor. */
export type Empty = CardsEmpty
/** @deprecated Import `Fact` from `basalt-ui/cards`; this alias is removed in the next minor. */
export type Fact = CardsFact
/** @deprecated Import `FootFacts` from `basalt-ui/cards`; this alias is removed in the next minor. */
export type FootFacts = CardsFootFacts
/** @deprecated Import `FrameHead` from `basalt-ui/cards`; this alias is removed in the next minor. */
export type FrameHead = CardsFrameHead
/** @deprecated Import `FrameState` from `basalt-ui/cards`; this alias is removed in the next minor. */
export type FrameState = CardsFrameState
/** @deprecated Import `Menu` from `basalt-ui/cards`; this alias is removed in the next minor. */
export type Menu = CardsMenu
/** @deprecated Import `MenuEntry` from `basalt-ui/cards`; this alias is removed in the next minor. */
export type MenuEntry = CardsMenuEntry
