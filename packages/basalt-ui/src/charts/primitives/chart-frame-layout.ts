/**
 * Pure, DOM-free layout math behind `ChartFrame`'s plot/legend split — extracted so the arithmetic
 * is testable without a `ResizeObserver` and `ChartFrame.tsx` stays the measuring/rendering shell.
 */

import { VX } from '../../tokens'
import type { LegendEntry } from './ChartLegend'
import { measureText } from '../utils/measure-text'

/** Line box of one legend row at `VX.legendFontSize`. */
const LEGEND_LINE_H = Math.ceil(VX.legendFontSize * 1.35)
/** `ChartLegend`'s own vertical wrapper padding (`8px 0 2px`). */
const LEGEND_PAD_Y = 10
/** Swatch plus the gap to its label — the fixed part of a legend entry's width. */
const LEGEND_SWATCH_W = 24

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
 *   the legend is capped instead ({@link legendEntryCap}). An unmeasured box (`resolvedHeight <=
 *   0`, i.e. a `fill` frame before its first measurement) stays at 0 and renders nothing, exactly
 *   as before — the floor must never invent a height for a box nobody has measured.
 */
export function resolvePlotRect(input: {
  containerW: number
  resolvedHeight: number
  minWidth: number
  sideLegendWidth: number
  topBottomLegendHeight: number
}): { width: number; height: number } {
  const { containerW, resolvedHeight, minWidth, sideLegendWidth, topBottomLegendHeight } = input
  return {
    width: containerW === 0 ? minWidth : Math.max(containerW - sideLegendWidth, 1),
    height:
      resolvedHeight <= 0 ? 0 : Math.max(resolvedHeight - topBottomLegendHeight, VX.minPlotHeight),
  }
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
 */
export function legendEntryCap(input: {
  items: readonly LegendEntry[]
  containerW: number
  /** Frame height the legend may consume — `resolvedHeight - VX.minPlotHeight`. */
  available: number
  /** An explicit caller cap always wins as the upper bound. */
  callerMaxRows?: number
}): number | undefined {
  const { items, containerW, available, callerMaxRows } = input
  if (containerW <= 0 || items.length === 0) return callerMaxRows
  const rows = Math.max(
    1,
    Math.floor((available - LEGEND_PAD_Y + VX.legendGap) / (LEGEND_LINE_H + VX.legendGap)),
  )
  if (
    legendBandHeight(rows) <= available &&
    entriesWithinRows(items, containerW, rows) >= items.length
  ) {
    return callerMaxRows
  }
  const fitted = Math.max(1, entriesWithinRows(items, containerW, rows))
  return callerMaxRows === undefined ? fitted : Math.min(fitted, callerMaxRows)
}
