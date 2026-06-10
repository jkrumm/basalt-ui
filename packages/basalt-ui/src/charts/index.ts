/**
 * Chart primitives surface — Mantine-free (ZERO `@mantine/*` imports, lint-enforced).
 *
 * S0 proves the @visx dependency boundary resolves and the Mantine-free rule holds by
 * re-exporting a representative set of raw @visx primitives. The full primitive/kind/sparkline
 * layer (ChartCard, ChartLegend, ChartTooltip, Axes, ZonedLine, Bars, StackedArea, Donut,
 * sparklines, hooks) lands in S2 — grounded in argo `packages/charts/src/index.ts`.
 *
 * visx is pinned EXACT at 4.0.0-alpha.11 across the 8 packages:
 *   @visx/axis @visx/curve @visx/event @visx/grid @visx/group @visx/scale @visx/shape @visx/threshold
 */

// ── Re-exported visx primitives (proves deps resolve + Mantine-free boundary) ──
export { Group } from '@visx/group'
export { GridRows, GridColumns } from '@visx/grid'
export { scaleLinear, scaleBand, scalePoint, scaleTime } from '@visx/scale'
export { LinePath, Bar, AreaClosed, BarStack, BarGroup, Line } from '@visx/shape'
export { Threshold } from '@visx/threshold'
export {
  curveMonotoneX,
  curveLinear,
  curveCatmullRom,
  curveStepAfter,
  curveBasis,
} from '@visx/curve'

// Re-export the Mantine-free token layer so chart consumers have one import surface.
export { VX, alpha, type ColorPair } from '../tokens'
