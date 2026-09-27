/**
 * Pure, DOM-free layout math behind `ChartFrame`'s plot/legend split — extracted so the arithmetic
 * is testable without a `ResizeObserver` and `ChartFrame.tsx` stays the measuring/rendering shell.
 */

import { HIT_COARSE } from '../../common/hit-floor'
import { VX } from '../../tokens'
import type { ContainerClass } from '../../tokens/size-classes'
import type { ChartMargin } from '../../tokens'
import type { LegendEntry } from './ChartLegend'
import type { SeriesRole } from '../series'
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
 * The real gap a dots-mode entry needs so its `[data-basalt-hit]::after` overlay can reach the
 * full 44px coarse floor with NO overlap into its neighbour's overlay (`hit-floor.layout.test.ts` +
 * `hit-overlap.layout.test.ts`, wave 4's cap: `styles.css`'s `::after` grows to
 * `min(max(size,44), size + 2 + gap)`). Two 44px-wide overlays centred on same-size hosts touch
 * with zero overlap only once their PITCH (real gap + host size) is itself >= 44 — below that, the
 * cap can only shrink the overlay below 44 (honouring WCAG 2.5.8's spacing route) or let it overlap;
 * there is no gap value that lets it hit 44 exactly while staying flush against a same-size sibling.
 * `LEGEND_DOT_SIZE` is 8px, so the floor is 44 − 8 − 2 = 34; a few px of headroom against rounding.
 */
export const LEGEND_DOT_SIZE = 8
export const DOTS_HIT_GAP = HIT_COARSE - LEGEND_DOT_SIZE - 2 + 4
/** One dot's full visual footprint in a wrapped row — the fit basis for dots mode. A chip's
 * swatch+label width badly overstates what a dot costs, so measuring dots as chips wrapped a
 * 4-entry legend to its own `All N` row. */
const DOT_PITCH = LEGEND_DOT_SIZE + DOTS_HIT_GAP

const GROUP_ORDER: SeriesRole[] = ['series', 'overlay', 'reference']
const roleOf = (item: LegendEntry): SeriesRole => item.role ?? 'series'

/**
 * Order entries series → overlay → reference and record where a divider belongs — the ONE ordering
 * both `ChartLegend`'s render and the resolver's fit math (`chart-layout.ts`) use, so a dots-mode
 * fit never disagrees with what actually wraps (a grouped legend renders dividers as flex items).
 */
export function orderEntries(
  items: readonly LegendEntry[],
  groups: boolean,
): { entries: LegendEntry[]; dividerAfter: ReadonlySet<number> } {
  if (!groups) return { entries: [...items], dividerAfter: new Set() }

  const dividerAfter = new Set<number>()
  const entries: LegendEntry[] = []
  const nonEmptyGroups = GROUP_ORDER.map((role) =>
    items.filter((item) => roleOf(item) === role),
  ).filter((group) => group.length > 0)
  nonEmptyGroups.forEach((group, i) => {
    entries.push(...group)
    if (i < nonEmptyGroups.length - 1) dividerAfter.add(entries.length - 1)
  })
  return { entries, dividerAfter }
}

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
 * `minWidth` is a FIRST-FRAME guard, applied only while `containerW` is still 0 (unmeasured, or
 * SSR); once measured the plot tracks the box exactly, floored at 1 so no scale divides by zero.
 * The legend band is subtracted first, and the remainder stops at `VX.minPlotHeight` — the frame's
 * flex box grows by the difference under a fixed height, and under `fill` (which cannot grow) the
 * legend is capped instead ({@link legendEntryCap}). A caller-stated `legend.maxRows` yields the
 * floor itself (`legendWins`) as far as the box has room ({@link SELF_MEASURED_SLACK}); an
 * unmeasured box (`resolvedHeight <= 0`) stays 0 and renders nothing.
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

/** Sub-pixel slack on "the frame measures its own legend band and nothing else" — absorbs a
 * future rounding or border difference between the two observers without re-opening the zero
 * fixpoint below. */
const SELF_MEASURED_SLACK = 0.5

/**
 * Is the frame's height its OWN content rather than a box something else stated?
 *
 * Under `fill` a frame in an unsized parent resolves its height to `auto`; its only children are
 * the plot and the legend, so `room === 0` means the box IS the legend band. There `legendWins`
 * must NOT yield the floor — with the floor gone the sequence has a fixpoint at zero (plot 0 →
 * content is the legend → box = band → room 0 → plot 0 forever). A NEGATIVE `room` is not this
 * case: a self-measured box can never be shorter than its own content, so the box was stated by
 * something else, and spending all of it on legend rows is the caller's arithmetic.
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

/** The greedy dot-pitch wrap `entriesWithinDotRows` runs twice — once optimistically, once against
 * a width that already gave up the `All N` chip's room. A group divider is its own flex item, so it
 * costs one more pitch before the next dot. */
function fitDotRows(
  items: readonly LegendEntry[],
  width: number,
  rows: number,
  dividerAfter: ReadonlySet<number>,
): number {
  let row = 1
  let x = 0
  let fitted = 0
  for (let i = 0; i < items.length; i += 1) {
    const next = x === 0 ? LEGEND_DOT_SIZE : x + DOT_PITCH + LEGEND_DOT_SIZE
    if (next > width && x > 0) {
      row += 1
      if (row > rows) return fitted
      x = LEGEND_DOT_SIZE
    } else {
      x = next
    }
    fitted += 1
    if (dividerAfter.has(i)) x += DOT_PITCH
  }
  return fitted
}

/**
 * How many of `items` fit as DOTS in `rows` wrapped rows of `width` — the dots-mode counterpart of
 * {@link entriesWithinRows}, measured at the dot's own pitch rather than a chip's width.
 * `dividerAfter` (from {@link orderEntries}) counts a rendered group divider's own gap.
 *
 * Two passes: every entry visible with no `All N` chip (if that fits, no chip is drawn); otherwise
 * reserve the chip's measured width up front so it can never wrap to a row of its own.
 */
export function entriesWithinDotRows(
  items: readonly LegendEntry[],
  width: number,
  rows: number,
  dividerAfter: ReadonlySet<number> = new Set(),
): number {
  const total = items.length
  const fittedNoReserve = fitDotRows(items, width, rows, dividerAfter)
  if (fittedNoReserve >= total) return fittedNoReserve
  const reserve = measureText(`All ${total}`, VX.legendFontSize) + DOT_PITCH
  return fitDotRows(items, Math.max(width - reserve, 0), rows, dividerAfter)
}

/**
 * The entry cap a `fill` frame's legend must respect so the plot keeps `VX.minPlotHeight`. A
 * `fill` frame is pinned to its cell, so the only lever is `ChartLegend`'s `maxRows` rollup; how
 * many entries fit follows from MEASURING the labels, not assuming one per row. Returns
 * `undefined` when the whole legend already fits.
 *
 * Resolves an ABSENT cap only: a caller who stated `legend.maxRows` never reaches here
 * ({@link resolveLegendRollup} routes around it), so the documented escape is never made inert.
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
