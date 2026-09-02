/**
 * `./charts` — Mantine-free visx chart system (ZERO `@mantine/*` imports, lint-enforced).
 *
 * Re-exports the framework token layer (so chart consumers have one import surface), the chart
 * theme context, the shared cursor (module-level store — charts sync with no provider; see
 * `docs/CHARTS-SPEC.md` §3), the primitives, kinds, sparklines, hooks, utils, and a curated set of
 * raw @visx primitives for bespoke charts.
 *
 * The framework ships ONLY generic primitives + framework palette data — no domain series tree
 * (apps rebuild that app-side with `seriesTokens` / `groupTokens` against their own series maps).
 * Grounded in argo `packages/charts/src/index.ts`.
 */

// ── Framework token surface (Mantine-free) ───────────────────────────────
export {
  VX,
  alpha,
  type ColorPair,
  type SeriesMap,
  buildPaletteCss,
  seriesTokens,
  defineSeries,
  groupTokens,
  chartMargin,
  type ChartMargin,
} from '../tokens'

// ── Design seam type (type-only; erased at runtime — no @mantine value) ─
export type { SeriesKey } from '../register'

// ── Chart theme + shared cursor ──────────────────────────────────────────
export { VxThemeProvider, useVxTheme, type VxTheme } from './theme'
export { ChartCursorScope, type ChartCursorScopeProps, useCursorState } from './cursor/scope'
export {
  createCursorStore,
  globalCursorStore,
  type CursorState,
  type CursorStore,
} from './cursor/store'

// ── Series descriptor (the legend/tooltip single source of truth) ────────
export {
  type SeriesMark,
  type SeriesDash,
  type SeriesCurve,
  curveFor,
  type SeriesRole,
  type LegendPlacement,
  type ChartLegendConfig,
  type SeriesStyle,
  type ChartSeries,
  deriveLegend,
  deriveTooltipRows,
} from './series'

// ── Primitives ───────────────────────────────────────────────────────────
export {
  CartesianChart,
  resolveAxisDomain,
  type CartesianChartProps,
  type CartesianTooltipConfig,
  type CartesianTooltipRowContext,
  type AxisConfig,
  type PlotContext,
} from './primitives/CartesianChart'
export {
  ChartFrame,
  type ChartFrameProps,
  type ChartFrameLegend,
  type PlotRect,
  resolveLegend,
} from './primitives/ChartFrame'
export {
  ChartCenter,
  type ChartCenterProps,
  ChartPending,
  type ChartPendingProps,
  ChartEmpty,
  type ChartEmptyProps,
  ChartError,
  type ChartErrorProps,
  type ChartState,
  type ResolvedChartState,
  resolveChartState,
} from './primitives/ChartPending'
export {
  useChartTier,
  useChartTierMetrics,
  chartTierMetrics,
  resolveChartTier,
  type ChartTier,
  type ChartTierMetrics,
} from './primitives/chart-tier'
export { Crosshair, SeriesDot } from './primitives/Crosshair'
export { HatchPattern, hatchFill, hatchSizeFor } from './primitives/HatchPattern'
export { ChartCard, type ChartCardProps, type ChartCardSlot } from './primitives/ChartCard'
export { ChartLegend, type LegendEntry } from './primitives/ChartLegend'
export {
  ChartTooltipFloat,
  TooltipHeader,
  TooltipRow,
  TooltipBody,
} from './primitives/ChartTooltip'
export {
  AxisBottomDate,
  AxisBottomNumeric,
  AxisLeftNumeric,
  AxisRightNumeric,
} from './primitives/Axes'
export { HoverOverlay } from './primitives/HoverOverlay'
export { ZoneRects, type ZoneSpec } from './primitives/ZoneRects'
export { XZoneRects, type XZoneSpec } from './primitives/XZoneRects'
export { AreaGradient, areaFillUrl } from './primitives/AreaGradient'

// ── Hooks ────────────────────────────────────────────────────────────────
export { useChartCursor, type ChartCursor, type CursorAnchor } from './hooks/useChartCursor'
export {
  foldBands,
  type BandFold,
  type BandTooltipConfig,
  type BandTooltipRowContext,
} from './hooks/useBandPlot'
export type { CursorResolution, DomainKind } from './cursor/resolve'
export { useChartSize, type UseChartSizeResult, type ChartSize } from './hooks/useChartSize'

// ── Utils ────────────────────────────────────────────────────────────────
export {
  fmtAxisDate,
  fmtTooltipDate,
  fmtCompact,
  type FmtCompactOptions,
  fmtPercent,
  type FmtPercentOptions,
  fmtCurrency,
  type FmtCurrencyOptions,
  fmtInt,
  formatters,
} from './utils/format'
export { smartTicks, smartTicksEvery, xLabelPxFor, autoXLabelRotate } from './utils/ticks'
export { autoMargin, probeAxisLabels, type AutoMarginInput } from './layout/auto-margin'
export { measureText, maxTextWidth } from './utils/measure-text'

// ── Kind components (owned by a sibling agent under ./kinds) ──────────────
export {
  ZonedLine,
  type ZonedLineProps,
  type ZonedLineThreshold,
  type ZonedLineRefLine,
} from './kinds/ZonedLine'

export { Bars, type BarsProps, type BarsBar, type BarsLine, type BarsRefLine } from './kinds/Bars'

export { StackedArea, type StackedAreaProps } from './kinds/StackedArea'
export { Donut, type DonutProps, type DonutDatum } from './kinds/Donut'

export { MultiLine, type MultiLineProps } from './kinds/MultiLine'
export { DualPanel, type DualPanelProps } from './kinds/DualPanel'
export { Heatmap, type HeatmapProps } from './kinds/Heatmap'
export {
  BandStrip,
  type BandStripProps,
  type BandStripSeries,
  type BandSpan,
} from './kinds/BandStrip'
export { MirroredBars, type MirroredBarsProps, type MirroredBarPane } from './kinds/MirroredBars'

// ── Sparklines ───────────────────────────────────────────────────────────
export {
  LineSparkline,
  type LineSparklineProps,
  BarSparkline,
  type BarSparklineProps,
} from './sparklines'

// ── Re-exported visx primitives ──────────────────────────────────────────
// Bespoke charts (genuinely unique compositions per CLAUDE.md) need raw
// visx primitives. Re-exporting them keeps the dependency declared in one
// place and preserves the rule that consumers only import from `basalt-ui/charts`.
export { Group } from '@visx/group'
export { GridRows, GridColumns } from '@visx/grid'
export { scaleLinear, scaleBand, scalePoint, scaleTime } from '@visx/scale'
export { LinePath, Bar, AreaClosed, AreaStack, BarStack, BarGroup, Line, Pie } from '@visx/shape'
export { Threshold } from '@visx/threshold'
export {
  curveMonotoneX,
  curveLinear,
  curveCatmullRom,
  curveStep,
  curveStepAfter,
  curveStepBefore,
  curveBasis,
} from '@visx/curve'
