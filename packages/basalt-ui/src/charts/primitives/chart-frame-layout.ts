/**
 * Pure, DOM-free layout math behind `ChartFrame`'s plot/legend split — extracted so the arithmetic
 * is testable without a `ResizeObserver` and `ChartFrame.tsx` stays the measuring/rendering shell.
 */

import { VX } from '../../tokens'
import type { ChartMargin } from '../../tokens'
import type { LegendEntry } from './ChartLegend'
import { measureText } from '../utils/measure-text'

/** Line box of one legend row at `VX.legendFontSize`. */
const LEGEND_LINE_H = Math.ceil(VX.legendFontSize * 1.35)
/** `ChartLegend`'s own vertical wrapper padding (`8px 0 2px`). */
const LEGEND_PAD_Y = 10
/** Swatch plus the gap to its label — the fixed part of a legend entry's width. */
const LEGEND_SWATCH_W = 24

/**
 * The two size tiers a chart resolves to. There are exactly two, and there is no `tablet`: the
 * tier exists to answer "is there room for full-size chrome around the plot", which is a yes/no
 * question, and a third rung would need a third calibrated metric set nothing has asked for.
 */
export type ChartTier = 'phone' | 'desktop'

/**
 * The tier a chart's chrome resolves to, from the width of the box it was MEASURED in — never
 * from a media query.
 *
 * A viewport breakpoint answers the wrong question. A chart in a 2-column grid cell on a 1440px
 * desktop is exactly as narrow as one filling a phone, and `@media` cannot see that; the
 * `ResizeObserver` `ChartFrame` already runs can. It also keeps this file (and the whole chart
 * layer) Mantine-free — `theme.breakpoints` is on the coupled side of the boundary.
 *
 * An UNMEASURED box (`containerW <= 0` — SSR, or before the observer's first callback) resolves
 * to `'desktop'`: the first frame must not paint phone chrome that then re-lays-out one frame
 * later, and `resolvePlotRect` already treats an unmeasured width as the first-frame case.
 */
export function resolveChartTier(containerW: number): ChartTier {
  return containerW > 0 && containerW < VX.phoneChartWidth ? 'phone' : 'desktop'
}

/**
 * A chart height stated per size step instead of as one number — the declarative escape from "every
 * chart on this page is 260px tall on a 375px phone too".
 *
 * `base` is required and is the height a box narrower than every named step gets; each further key
 * is the height from that step UP. Keys are Mantine's breakpoint names so a consumer writes the
 * vocabulary they already write, and nothing more than `sm`/`md`/`lg` is offered: `xs`/`xl` would
 * be two more rungs nobody has asked a chart to have.
 *
 * ```tsx
 * <ChartFrame series={series} height={{ base: 180, md: 260 }}>{…}</ChartFrame>
 * ```
 */
export type ResponsiveChartHeight = {
  /** Below the narrowest STATED step — and NOT the first-frame value; see {@link resolveFrameHeight}. */
  base: number
  /** From 768px of MEASURED container width up. */
  sm?: number
  /** From 992px up. */
  md?: number
  /** From 1200px up. */
  lg?: number
}

/**
 * The measured CONTAINER width, in px, each {@link ResponsiveChartHeight} key takes effect at.
 *
 * The numbers are what Mantine's `sm`/`md`/`lg` breakpoints resolve to at the 16px initial font
 * size, so a consumer's mental model transfers — but they are compared against the element's own
 * MEASURED box, never the viewport, for the reason {@link resolveChartTier} states: a chart in a
 * `PageAside`-squeezed grid cell on a 1440px desktop is as narrow as one on a phone, and the
 * viewport agrees with neither. Keeping them as plain numbers here is also what keeps this file
 * Mantine-free — `theme.breakpoints` is on the coupled side of the boundary.
 */
const HEIGHT_STEP_WIDTH = { sm: 768, md: 992, lg: 1200 } as const

/** Widest-first, so the first step that fits is the answer. */
const HEIGHT_STEPS = ['lg', 'md', 'sm'] as const

/**
 * Resolve a `height` prop — a plain number, or a {@link ResponsiveChartHeight} — against the
 * measured container width.
 *
 * A plain number passes through untouched: this is a WIDENING of the prop, not a replacement, and
 * every existing `height={240}` must keep meaning exactly 240.
 *
 * An UNMEASURED box (`containerW <= 0` — SSR, or before the `ResizeObserver`'s first callback)
 * resolves to the LARGEST stated step, matching {@link resolveChartTier}'s first-frame rule: the
 * first paint must not be phone-shaped chrome that grows one frame later. Falling to `base` there
 * would make every SSR'd chart short and then jump.
 */
export function resolveFrameHeight(
  height: number | ResponsiveChartHeight,
  containerW: number,
): number {
  if (typeof height === 'number') return height
  const widest = HEIGHT_STEPS.find((step) => height[step] !== undefined)
  if (containerW <= 0) return widest === undefined ? height.base : (height[widest] ?? height.base)
  const step = HEIGHT_STEPS.find(
    (name) => containerW >= HEIGHT_STEP_WIDTH[name] && height[name] !== undefined,
  )
  return step === undefined ? height.base : (height[step] ?? height.base)
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

/** Legend entries a phone-tier legend renders before rolling the rest into `+N more`. Two is the
 * cap because a third entry wraps at every realistic phone width, and a wrapped legend is what
 * eats the plot (`legendEntryCap`). */
const PHONE_LEGEND_MAX_ROWS = 2

/** Tooltip `minWidth`, per tier — 140px is 39% of a 360px screen. */
const TOOLTIP_MIN_WIDTH = { desktop: 140, phone: 110 } as const

/** Every size a chart's chrome resolves per tier. One object so a new tier-sensitive size is added
 * in one place and read by name, rather than each primitive branching on the tier itself. */
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
  /** Default entry cap on the legend, or `undefined` for no default cap. An explicit
   * `legend.maxRows` replaces it outright ({@link resolveLegendMaxRows}). */
  legendMaxRows: number | undefined
  /** Per-side margin FLOORS (`VX.margin` is a floor, never a ceiling — §1). */
  margin: ChartMargin
}

const DESKTOP_METRICS: ChartTierMetrics = {
  tier: 'desktop',
  axisFont: VX.axisFont,
  legendFontSize: VX.legendFontSize,
  dotR: VX.dotR,
  tooltipMinWidth: TOOLTIP_MIN_WIDTH.desktop,
  legendMaxRows: undefined,
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
  legendMaxRows: PHONE_LEGEND_MAX_ROWS,
  margin: {
    top: Math.round(VX.margin.top * PHONE_MARGIN_SCALE),
    right: Math.round(VX.margin.right * PHONE_MARGIN_SCALE),
    bottom: Math.round(VX.margin.bottom * PHONE_MARGIN_SCALE),
    left: Math.round(VX.margin.left * PHONE_MARGIN_SCALE),
  },
}

/** The resolved sizes for one tier. Frozen module constants — never a new object per render. */
export function chartTierMetrics(tier: ChartTier): ChartTierMetrics {
  return tier === 'phone' ? PHONE_METRICS : DESKTOP_METRICS
}

/**
 * Which legend cap applies: the caller's, or the tier's own default.
 *
 * **An explicit `callerMaxRows` wins OUTRIGHT.** This used to be `Math.min(caller, tier)`, which
 * made the documented per-chart opt-out ("opt back out with an explicit `legend.maxRows`") false in
 * the one direction anybody needs it. The tier's `PHONE_LEGEND_MAX_ROWS` is a DEFAULT for charts
 * that said nothing — a chart that names a number has already answered the question the default
 * exists to answer, and it matters because the tier keys on the measured box: a 380px inspector
 * panel on a 1440px desktop is "a phone", so a six-series legend rolled up to two rows + `+4 more`
 * with no way to say no. `margin` and `xLabelRotate` always had that escape; the legend did not.
 *
 * The measured {@link legendEntryCap} a `fill` frame applies is NOT a second ceiling on top of
 * this: it resolves an ABSENT cap only. 1.30.0 ran it over the caller's number as well
 * (`Math.min(fitted, caller)`), which made "wins outright" false again in the one place it was
 * needed — weatherorb measured a 7-entry legend pinned to 2 entries at `maxRows` 3, 6 AND 99, with 5
 * series drawn in colours the legend refused to name. The fit is not physics either: it derives
 * from `VX.minPlotHeight`, which is a framework DEFAULT about the plot. Two defaults do not
 * outvote the one number a caller stated, so the PLOT yields the height instead
 * ({@link resolvePlotRect}'s `legendWins`) — visibly, in the frame the caller sized.
 */
export function resolveLegendMaxRows(input: {
  callerMaxRows?: number | undefined
  tier: ChartTier
}): number | undefined {
  return input.callerMaxRows ?? chartTierMetrics(input.tier).legendMaxRows
}

/**
 * The whole legend-cap decision in one place: which cap `ChartLegend` gets, and whether the plot
 * pays for it.
 *
 * It lives here rather than inline in `ChartFrame` because the COMPOSITION is what broke. 1.30.0
 * had both halves right on their own — {@link resolveLegendMaxRows} honoured a stated cap,
 * {@link legendEntryCap} measured a fit — and then ran the second over the first, which no test
 * could see because neither pure function was wrong and the frame that combined them needs a
 * `ResizeObserver` to test. Now the combination is a pure function too.
 *
 * Three cases, in order:
 * 1. The caller STATED a number → it is the cap, and on a `fill` band the plot yields
 *    (`legendWins`). Nothing measured or defaulted trims it.
 * 2. No `fill` band → the tier's default (or none), because the frame simply grows.
 * 3. A `fill` band with nothing stated → the measured fit, bounded by the tier's default.
 */
export function resolveLegendRollup(input: {
  /** The caller's own `legend.maxRows`. */
  statedMaxRows?: number | undefined
  tier: ChartTier
  /** A visible top/bottom legend on a `fill` frame — the one shape whose box cannot grow. */
  fillBand: boolean
  items: readonly LegendEntry[]
  containerW: number
  /** Frame height the legend may consume — `resolvedHeight - VX.minPlotHeight`. */
  available: number
}): { maxRows: number | undefined; legendWins: boolean } {
  const { statedMaxRows, tier, fillBand, items, containerW, available } = input
  if (statedMaxRows !== undefined) return { maxRows: statedMaxRows, legendWins: fillBand }
  const tierMaxRows = resolveLegendMaxRows({ callerMaxRows: undefined, tier })
  if (!fillBand) return { maxRows: tierMaxRows, legendWins: false }
  return {
    maxRows: legendEntryCap({
      items,
      containerW,
      available,
      ...(tierMaxRows !== undefined && { defaultMaxRows: tierMaxRows }),
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
  LEGEND_PAD_Y + rows * LEGEND_LINE_H + Math.max(rows - 1, 0) * VX.legendGap

/** Width one legend entry occupies — swatch, gap, label, and the note that rides after it. */
const legendEntryWidth = (item: LegendEntry): number =>
  LEGEND_SWATCH_W +
  measureText(
    item.note === undefined ? item.label : `${item.label} ${item.note}`,
    VX.legendFontSize,
  )

/** How many of `items` fit in `rows` wrapped rows of `width` — the same greedy wrap the flex
 * container performs, measured rather than assumed (`docs/CHARTS-SPEC.md` §1). */
function entriesWithinRows(items: readonly LegendEntry[], width: number, rows: number): number {
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
 * ({@link resolveLegendMaxRows}).
 */
export function legendEntryCap(input: {
  items: readonly LegendEntry[]
  containerW: number
  /** Frame height the legend may consume — `resolvedHeight - VX.minPlotHeight`. */
  available: number
  /**
   * The cap that applies when nothing explicit was stated — today only the tier's own default
   * ({@link chartTierMetrics}). Two defaults contending: the smaller wins.
   */
  defaultMaxRows?: number
}): number | undefined {
  const { items, containerW, available, defaultMaxRows } = input
  if (containerW <= 0 || items.length === 0) return defaultMaxRows
  const rows = Math.max(
    1,
    Math.floor((available - LEGEND_PAD_Y + VX.legendGap) / (LEGEND_LINE_H + VX.legendGap)),
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
