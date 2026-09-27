/**
 * Pure, DOM-free layout math behind `ChartFrame`'s plot/legend split — extracted so the arithmetic
 * is testable without a `ResizeObserver` and `ChartFrame.tsx` stays the measuring/rendering shell.
 */

import { VX } from '../../tokens'
import type { ContainerClass } from '../../tokens/size-classes'
import type { ChartMargin } from '../../tokens'
import type { LegendEntry } from './ChartLegend'
import { measureText } from '../utils/measure-text'

/** Line box of one legend row at `VX.legendFontSize`. */
const LEGEND_LINE_H = Math.ceil(VX.legendFontSize * 1.35)
/** `ChartLegend`'s own vertical wrapper padding (`8px 0 2px`). */
const LEGEND_PAD_Y = 10
/** Gap between two wrapped legend rows — tight (4-6px); the wider `VX.legendGap` separates entries. */
export const LEGEND_ROW_GAP = 6
/** Swatch plus the gap to its label — the fixed part of a legend entry's width. */
const LEGEND_SWATCH_W = 24

/**
 * The two metric sets a chart's chrome resolves to. Internally the container class
 * (`micro`/`compact` → `'phone'`, `regular`/`wide` → `'desktop'`) picks one; there is no `tablet`.
 * Internal only — not on any public barrel.
 */
export type ChartTier = 'phone' | 'desktop'

/**
 * A chart height stated per container step instead of as one number — the declarative escape from
 * "every chart on this page is 260px tall on a 375px phone too".
 *
 * `base` is the height below the `regular` class; `regular` and `wide` take effect from
 * `CONTAINER_CLASSES.regular` / `.wide` of the frame's MEASURED width (never the viewport).
 *
 * ```tsx
 * <ChartFrame series={series} height={{ base: 180, wide: 260 }}>{…}</ChartFrame>
 * ```
 */
export type ResponsiveChartHeight = {
  base: number
  /** From the `regular` container class (480px) up. */
  regular?: number
  /** From the `wide` container class (800px) up. */
  wide?: number
}

/**
 * Resolve a `height` prop — a plain number, or a {@link ResponsiveChartHeight} — for a container
 * class. A plain number passes through untouched. The class is the measured one, or, before the
 * first measurement, the one implied by the viewport ({@link resolveChartLayout}), so the first
 * frame is not a different height from the second.
 */
export function resolveFrameHeight(
  height: number | ResponsiveChartHeight,
  containerClass: ContainerClass,
): number {
  if (typeof height === 'number') return height
  if (containerClass === 'wide') return height.wide ?? height.regular ?? height.base
  if (containerClass === 'regular') return height.regular ?? height.base
  return height.base
}

/**
 * How much of `VX.margin` a phone-tier chart keeps as its FLOOR. The measured law is unchanged —
 * a side may still only grow past its floor (`autoMargin`) — this only stops a static token from
 * spending 44px of a 360px chart on a gutter three characters wide.
 */
const PHONE_MARGIN_SCALE = 0.75

/** Phone-tier crosshair dot radius. One step in, so the marker still reads as a punched hole at
 * the smaller stroke widths a narrow chart draws. */
const PHONE_DOT_R = Math.max(VX.dotR - 1, 2)

/** Tooltip `minWidth`, per tier — 140px is 39% of a 360px screen. */
const TOOLTIP_MIN_WIDTH = { desktop: 140, phone: 110 } as const

/**
 * Every size a chart's chrome resolves per tier. One object so a new tier-sensitive size is added
 * in one place and read by name, rather than each primitive branching on the tier itself. Internal
 * only — not on any public barrel.
 */
export type ChartTierMetrics = {
  /** Which tier these are, so a consumer of the metrics never needs both values threaded. */
  tier: ChartTier
  /** Axis tick label font size, px. Threaded into BOTH `autoMargin`'s measurement and the painted
   * axis — measured labels must be the painted labels (`docs/CHARTS-SPEC.md` §1). */
  axisFont: number
  /** Legend label font size, px. */
  legendFontSize: number
  /** Crosshair dot radius, px. */
  dotR: number
  /** Floating tooltip `minWidth`, px. */
  tooltipMinWidth: number
  /** Per-side margin FLOORS (`VX.margin` is a floor, never a ceiling — §1). */
  margin: ChartMargin
}

const DESKTOP_METRICS: ChartTierMetrics = {
  tier: 'desktop',
  axisFont: VX.axisFont,
  legendFontSize: VX.legendFontSize,
  dotR: VX.dotR,
  tooltipMinWidth: TOOLTIP_MIN_WIDTH.desktop,
  margin: VX.margin,
}

const PHONE_METRICS: ChartTierMetrics = {
  tier: 'phone',
  // One step DOWN the shared type ladder, never an arbitrary px value: micro → nano for ticks,
  // sm → xs for the legend (`TEXT` in tokens/index.ts).
  axisFont: VX.text.nano,
  legendFontSize: VX.text.xs,
  dotR: PHONE_DOT_R,
  tooltipMinWidth: TOOLTIP_MIN_WIDTH.phone,
  margin: {
    top: Math.round(VX.margin.top * PHONE_MARGIN_SCALE),
    right: Math.round(VX.margin.right * PHONE_MARGIN_SCALE),
    bottom: Math.round(VX.margin.bottom * PHONE_MARGIN_SCALE),
    left: Math.round(VX.margin.left * PHONE_MARGIN_SCALE),
  },
}

/** The metric set a container class resolves to (`micro`/`compact` → phone, else desktop). */
export function chartMetrics(containerClass: ContainerClass): ChartTierMetrics {
  return containerClass === 'micro' || containerClass === 'compact'
    ? PHONE_METRICS
    : DESKTOP_METRICS
}

/**
 * The whole legend-cap decision in one place: which cap `ChartLegend` gets, and whether the plot
 * pays for it. Pure, because the COMPOSITION is what once broke (1.30.0 ran a measured fit over a
 * caller's stated number) and the frame that combines them needs a `ResizeObserver` to test.
 *
 * Three cases, in order:
 * 1. The caller STATED `legend.maxRows` (deprecated, still honoured) → it is the cap, and on a
 *    `fill` band the plot yields (`legendWins`). Nothing measured trims it.
 * 2. No `fill` band → the resolver's width-measured fit (`fittedMaxRows`), because the frame grows.
 * 3. A `fill` band with nothing stated → the tighter of that fit and the height-measured
 *    {@link legendEntryCap}, because a `fill` box cannot grow.
 */
export function resolveLegendRollup(input: {
  /** The caller's own `legend.maxRows`. */
  statedMaxRows?: number | undefined
  /** `resolveChartLayout().legend.visible` when it overflows, else `undefined`. */
  fittedMaxRows?: number | undefined
  /** A visible top/bottom legend on a `fill` frame — the one shape whose box cannot grow. */
  fillBand: boolean
  items: readonly LegendEntry[]
  containerW: number
  /** Frame height the legend may consume — `resolvedHeight - VX.minPlotHeight`. */
  available: number
}): { maxRows: number | undefined; legendWins: boolean } {
  const { statedMaxRows, fittedMaxRows, fillBand, items, containerW, available } = input
  if (statedMaxRows !== undefined) return { maxRows: statedMaxRows, legendWins: fillBand }
  if (!fillBand) return { maxRows: fittedMaxRows, legendWins: false }
  return {
    maxRows: legendEntryCap({
      items,
      containerW,
      available,
      ...(fittedMaxRows !== undefined && { defaultMaxRows: fittedMaxRows }),
    }),
    legendWins: false,
  }
}

/**
 * Resolve the plot rect from the measured box and the measured legend band. Pure and exported so
 * the two floors below are testable without a `ResizeObserver`.
 *
 * Two floors, and each is only a floor while it is honest:
 * - **width** — `minWidth` is a FIRST-FRAME guard, applied only while `containerW` is still 0
 *   (unmeasured, or SSR, where the observer never fires). Once measured the plot tracks the box
 *   exactly, floored at 1 so no scale divides by zero: applying a 200px floor forever drew an SVG
 *   wider than its own container inside any narrower grid cell.
 * - **height** — the legend band is subtracted first (it always was), but the remainder can no
 *   longer collapse: eight entries wrapping to five rows at phone width ate a fixed
 *   `height={240}` toward zero and the body stopped rendering entirely. The plot stops at
 *   `VX.minPlotHeight` and the frame's own box grows by the difference instead — it is a flex
 *   column with `height: auto`, so that growth is automatic. Under `fill` the box CANNOT grow, so
 *   the legend is capped instead ({@link legendEntryCap}) — UNLESS the caller stated
 *   `legend.maxRows`, which is `legendWins`: there the floor itself yields, because a floor is a
 *   default and the caller's number is not, but only as far as the box HAS room
 *   ({@link SELF_MEASURED_SLACK}). An unmeasured box (`resolvedHeight <= 0`, i.e. a `fill` frame
 *   before its first measurement) stays at 0 and renders nothing, exactly as before — the floor
 *   must never invent a height for a box nobody has measured.
 */
export function resolvePlotRect(input: {
  containerW: number
  resolvedHeight: number
  minWidth: number
  sideLegendWidth: number
  topBottomLegendHeight: number
  /**
   * The caller stated `legend.maxRows` on a `fill` frame, so the legend takes the rows it asked
   * for and the plot takes what is left — `VX.minPlotHeight` stops being a floor. Without this the
   * honoured cap would push the frame's content PAST its own cell (the plot holds 120px, the legend
   * band adds its own) and paint over whatever sits below it; with it, the cost of the caller's
   * number lands where they can see it. Spend the whole box on legend rows and there is no plot
   * left to draw — that is their arithmetic, made visible rather than silently rolled up.
   */
  legendWins?: boolean
}): { width: number; height: number } {
  const {
    containerW,
    resolvedHeight,
    minWidth,
    sideLegendWidth,
    topBottomLegendHeight,
    legendWins = false,
  } = input
  const room = resolvedHeight - topBottomLegendHeight
  const plotFloor = legendWins && !isSelfMeasured(room) ? 0 : VX.minPlotHeight
  return {
    width: containerW === 0 ? minWidth : Math.max(containerW - sideLegendWidth, 1),
    height: resolvedHeight <= 0 ? 0 : Math.max(room, plotFloor),
  }
}

/**
 * Sub-pixel slack on "the frame measures its own legend band and nothing else".
 *
 * MEASURED exact in the collapse this guards (both `ResizeObserver` contentRects read 29.375 in
 * headless Chrome, `tests/layout/charts.layout.test.ts` INVARIANT 7) — the slack exists only so a
 * future rounding or border difference between the two observers cannot re-open a fixpoint that
 * has no other way out. A plot this thin has nothing to draw either way.
 */
const SELF_MEASURED_SLACK = 0.5

/**
 * Is the frame's height its OWN content rather than a box something else stated?
 *
 * `ChartFrame` measures its own node (`useChartSize` → visx `useParentSize` observes the element
 * the ref is attached to, its name notwithstanding), and under `fill` its `height: 100%` resolves
 * to `auto` in any parent that states no height. Its only children are the plot and the legend, so
 * `room === 0` means the box IS the legend band — which happens exactly when no plot was drawn.
 *
 * That is why `legendWins` cannot yield the floor there: with the floor gone the sequence has a
 * FIXPOINT AT ZERO — plot 0 → content is the legend → box = band → room 0 → plot 0, forever, and
 * the chart never appears. Keeping the floor while `room` is 0 converges on the same box a `fill`
 * frame in an unsized parent has always had (plot `VX.minPlotHeight`, box = plot + band), from
 * which `room` is positive and `legendWins` applies normally.
 *
 * A NEGATIVE `room` is not this case and must keep yielding: a self-measured box can never be
 * shorter than its own content, so a band taller than the box means the box was stated by
 * something else, and spending all of it on legend rows is the caller's own arithmetic.
 */
function isSelfMeasured(room: number): boolean {
  return room >= 0 && room < SELF_MEASURED_SLACK
}

/** Height of a legend band `rows` rows tall, wrapper padding included. */
const legendBandHeight = (rows: number): number =>
  LEGEND_PAD_Y + rows * LEGEND_LINE_H + Math.max(rows - 1, 0) * LEGEND_ROW_GAP

/** Width one legend entry occupies — swatch, gap, label, and the note that rides after it. */
const legendEntryWidth = (item: LegendEntry): number =>
  LEGEND_SWATCH_W +
  measureText(
    item.note === undefined ? item.label : `${item.label} ${item.note}`,
    VX.legendFontSize,
  )

/** How many of `items` fit in `rows` wrapped rows of `width` — the same greedy wrap the flex
 * container performs, measured rather than assumed (`docs/CHARTS-SPEC.md` §1). */
export function entriesWithinRows(
  items: readonly LegendEntry[],
  width: number,
  rows: number,
): number {
  let row = 1
  let x = 0
  let fitted = 0
  for (const item of items) {
    const w = legendEntryWidth(item)
    const next = x === 0 ? w : x + VX.legendGap + w
    if (next > width && x > 0) {
      row += 1
      if (row > rows) return fitted
      x = w
    } else {
      x = next
    }
    fitted += 1
  }
  return fitted
}

/**
 * The entry cap a `fill` frame's legend must respect so the plot keeps `VX.minPlotHeight`.
 *
 * A fixed-height frame grows to fit its legend; a `fill` frame is pinned to its cell, so the only
 * remaining lever is `ChartLegend`'s `maxRows` rollup (an ENTRY cap — see its JSDoc). The rows the
 * legend may take follow from the height left over; how many entries that is follows from
 * MEASURING the labels, not from assuming one entry per row — otherwise a five-entry legend that
 * fits on one line would roll up to `+2 more` in every 240px cell, moving rendering for charts
 * that never had the bug. Returns `undefined` when the whole legend already fits.
 *
 * This resolves an ABSENT cap. A caller who stated `legend.maxRows` never reaches here at all —
 * `ChartFrame` routes around it — because `Math.min`-ing a stated number against this one made the
 * documented escape inert in exactly the narrow `fill` panel it exists for
 * ({@link resolveLegendRollup}).
 */
export function legendEntryCap(input: {
  items: readonly LegendEntry[]
  containerW: number
  /** Frame height the legend may consume — `resolvedHeight - VX.minPlotHeight`. */
  available: number
  /**
   * The cap that applies when nothing explicit was stated — the resolver's width fit. Two
   * defaults contending: the smaller wins.
   */
  defaultMaxRows?: number
}): number | undefined {
  const { items, containerW, available, defaultMaxRows } = input
  if (containerW <= 0 || items.length === 0) return defaultMaxRows
  const rows = Math.max(
    1,
    Math.floor((available - LEGEND_PAD_Y + LEGEND_ROW_GAP) / (LEGEND_LINE_H + LEGEND_ROW_GAP)),
  )
  if (
    legendBandHeight(rows) <= available &&
    entriesWithinRows(items, containerW, rows) >= items.length
  ) {
    return defaultMaxRows
  }
  const fitted = Math.max(1, entriesWithinRows(items, containerW, rows))
  return defaultMaxRows === undefined ? fitted : Math.min(fitted, defaultMaxRows)
}
