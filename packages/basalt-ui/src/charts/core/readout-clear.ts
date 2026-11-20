/**
 * Keeping the axis hover readout off the tick labels. The crosshair draws the focused x and y value
 * on the axes at the pointer (`crosshairMarks`); a tick label under it reads as one garbled string
 * (`18194`, `Apr Apr 2`). The engine hands a tick label's opacity callback the live focus after
 * layout (it restores the base opacity when focus clears and never re-thins), so a label whose box the
 * readout would cover is blanked while it is focused: the readout replaces the tick it lands on.
 *
 * Boxes are estimates (`captionWidth`, an over-estimate) plus the halo's reach, so a near miss hides a
 * tick rather than leaving glyphs touching.
 */
import type { ChartValue } from '@tanstack/charts/types/core'
import { captionWidth } from '../axis-gaps'

type Anchor = 'start' | 'middle' | 'end'
type Span = readonly [from: number, to: number]

/** The part of the engine's focus a tick label reads: where the readouts sit and the values they name. */
export type ReadoutFocus = {
  readonly primary: {
    readonly x: number
    readonly y: number
    readonly xValue: ChartValue
    /** The focused datum's y (the engine's `FocusItem.yValue`): the value the y chip prints. */
    readonly yValue?: ChartValue
  }
} | null

/** Where a value sits along its axis: 0 at the plot's left (x) or bottom (y) edge, 1 at the far edge; `null` when unknown. */
export type EdgeShare = (value: ChartValue) => number | null

/**
 * The plot's lower-left corner, read from the axes' values: the x chip hangs left of the plot's edge
 * over the y gutter's lowest tick, and the y chip hangs below the plot's bottom over the x axis' first
 * tick, so each cross-axis tick is blanked while the other axis' chip sits in the corner.
 */
export type Corner = {
  x: EdgeShare
  y: EdgeShare
  /** Whether this chart draws an x chip now (it labels its x axis and does not follow another chart); default yes. */
  xChip?: () => boolean
}

/** How near the left edge an x value sits, as a share of the plot's width, for its chip to reach the y gutter (the chip is ~28 px wide). */
const CORNER_X = 0.06
/** How near the bottom edge a y value sits, as a share of the plot's height, for its chip to reach the x tick row. */
const CORNER_Y = 0.1
/** The x tick labels that can reach the y chip: the first (start-anchored within 5%) and one centred just in from it. */
const CORNER_TICK_X = 0.12

const inCorner = (share: number | null, within: number): boolean =>
  share !== null && share <= within

/** Air kept round a readout, px: the reach of its 6 px halo (3) and a gap of 2. */
const READOUT_AIR = 5
/** The inset the engine keeps between a readout and the chart's edge, px (`clampLabel`). */
const EDGE_INSET = 2
/** A readout's line box as a multiple of its font size: what a tick label above or below it must clear. */
const LINE_BOX = 1.25

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi)

const spanOf = (at: number, width: number, anchor: Anchor): Span =>
  anchor === 'start'
    ? [at, at + width]
    : anchor === 'end'
      ? [at - width, at]
      : [at - width / 2, at + width / 2]

const meet = (a: Span, b: Span): boolean => a[0] < b[1] && b[0] < a[1]

/** What one tick label needs to know to find its own box. */
export type XTickText = {
  /** The tick text the axis prints for a value. */
  text: (value: ChartValue) => string
  anchor: (value: ChartValue) => Anchor | undefined
  dx: (value: ChartValue) => number | undefined
}

/**
 * The opacity callback of an x axis: `1`, or `0` while the focused x readout would land on this label.
 * `readoutText` is what the crosshair prints for an x; `width` the chart's, so a readout the engine
 * pushes in from the edge is measured where it is drawn.
 */
export function xTickOpacity(opts: {
  tick: XTickText
  readoutText: (value: ChartValue) => string
  fontSize: number
  width: number | undefined
  /** Given, the first tick is also blanked while the y chip sits at the plot's bottom. */
  corner?: Corner | undefined
}): (context: { value: ChartValue; position: number; focus: ReadoutFocus }) => number {
  const { tick, readoutText, fontSize, width, corner } = opts
  return ({ value, position, focus }) => {
    if (focus === null) return 1
    const { x, xValue } = focus.primary
    if (!Number.isFinite(x)) return 1
    const half = captionWidth(readoutText(xValue), fontSize) / 2
    const centre =
      width === undefined
        ? x
        : clamp(x, EDGE_INSET + half, Math.max(EDGE_INSET + half, width - EDGE_INSET - half))
    const readout: Span = [centre - half - READOUT_AIR, centre + half + READOUT_AIR]
    const label = spanOf(
      position + (tick.dx(value) ?? 0),
      captionWidth(tick.text(value), fontSize),
      tick.anchor(value) ?? 'middle',
    )
    if (meet(readout, label)) return 0
    const { yValue } = focus.primary
    return corner !== undefined &&
      typeof yValue === 'number' &&
      inCorner(corner.y(yValue), CORNER_Y) &&
      inCorner(corner.x(value), CORNER_TICK_X)
      ? 0
      : 1
  }
}

/**
 * The opacity callback of a y axis: `0` while the focused y readout, drawn beside the axis, is on this
 * tick's row (`chip`), and for the lowest tick while the x chip sits at the plot's left edge (`corner`).
 */
export function yTickOpacity(opts: {
  fontSize: number
  /** The hover pins its y value beside this axis. */
  chip: boolean
  corner?: Corner | undefined
}): (context: { value: ChartValue; position: number; focus: ReadoutFocus }) => number {
  const { fontSize, chip, corner } = opts
  const reach = fontSize * LINE_BOX + READOUT_AIR
  return ({ value, position, focus }) => {
    if (focus === null) return 1
    if (chip && Number.isFinite(focus.primary.y) && Math.abs(position - focus.primary.y) < reach)
      return 0
    return corner !== undefined &&
      corner.xChip?.() !== false &&
      inCorner(corner.x(focus.primary.xValue), CORNER_X) &&
      inCorner(corner.y(value), CORNER_Y)
      ? 0
      : 1
  }
}
