/**
 * `./charts` — Mantine-free visx chart system (ZERO `@mantine/*` imports, lint-enforced).
 *
 * Re-exports the framework token layer (so chart consumers have one import surface), the chart
 * theme context, the shared-cursor hover context, the primitives, kinds, sparklines, hooks, utils,
 * and a curated set of raw @visx primitives for bespoke charts.
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
  BP,
  SEMANTIC,
  STATUS,
  NEUTRAL,
  SURFACE,
} from '../tokens'

// ── Design seam type (type-only; erased at runtime — no @mantine value) ─
export type { SeriesKey } from '../register'

// ── Chart theme + hover context ──────────────────────────────────────────
export { VxThemeProvider, useVxTheme, type VxTheme } from './theme'
export { HoverContext, DEFAULT_NO_OP_SET_HOVER, type HoverCtx } from './hover-context'
export { ChartHoverSync, type ChartHoverSyncProps } from './hover-sync'

// ── Primitives ───────────────────────────────────────────────────────────
export { ChartCard } from './primitives/ChartCard'
export { ChartLegend, type LegendEntry } from './primitives/ChartLegend'
export {
  ChartTooltip,
  TooltipHeader,
  TooltipRow,
  TooltipBody,
  useTooltipStyles,
} from './primitives/ChartTooltip'
export { AxisBottomDate, AxisLeftNumeric, AxisRightNumeric } from './primitives/Axes'
export { HoverOverlay } from './primitives/HoverOverlay'
export { ZoneRects, type ZoneSpec } from './primitives/ZoneRects'
export { AreaGradient, areaFillUrl } from './primitives/AreaGradient'

// ── Hooks ────────────────────────────────────────────────────────────────
export { useChartTooltip, type TooltipState } from './hooks/useChartTooltip'
export { useHoverSync } from './hooks/useHoverSync'

// ── Utils ────────────────────────────────────────────────────────────────
export { fmtAxisDate, fmtTooltipDate } from './utils/format'
export { smartTicks } from './utils/ticks'

// ── Kind components (owned by a sibling agent under ./kinds) ──────────────
export {
  ZonedLine,
  type ZonedLineProps,
  type ZonedLineZone,
  type ZonedLineThreshold,
  type ZonedLineRefLine,
  type ZonedLineTooltipLabel,
} from './kinds/ZonedLine'

export {
  Bars,
  type BarsProps,
  type BarsBar,
  type BarsLine,
  type BarsZone,
  type BarsRefLine,
  type BarsAxisConfig,
} from './kinds/Bars'

export { StackedArea, type StackedAreaProps } from './kinds/StackedArea'
export { Donut, type DonutProps, type DonutDatum } from './kinds/Donut'

export { MultiLine, type MultiLineProps, type MultiLineSeries } from './kinds/MultiLine'
export { DualPanel, type DualPanelProps, type DualPanelLine } from './kinds/DualPanel'
export { Heatmap, type HeatmapProps } from './kinds/Heatmap'

// ── Sparklines ───────────────────────────────────────────────────────────
export { LineSparkline, BarSparkline } from './sparklines'

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
  curveStepAfter,
  curveBasis,
} from '@visx/curve'
