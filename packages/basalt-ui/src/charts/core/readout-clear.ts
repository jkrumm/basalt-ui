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

/** The part of the engine's focus a tick label reads: where the readouts sit and the x they name. */
export type ReadoutFocus = {
  readonly primary: { readonly x: number; readonly y: number; readonly xValue: ChartValue }
} | null

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
}): (context: { value: ChartValue; position: number; focus: ReadoutFocus }) => number {
  const { tick, readoutText, fontSize, width } = opts
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
    return meet(readout, label) ? 0 : 1
  }
}

/** The opacity callback of a y axis: `0` while the focused y readout, drawn beside the axis, is on this tick's row. */
export function yTickOpacity(
  fontSize: number,
): (context: { position: number; focus: ReadoutFocus }) => number {
  const reach = fontSize * LINE_BOX + READOUT_AIR
  return ({ position, focus }) => {
    if (focus === null || !Number.isFinite(focus.primary.y)) return 1
    return Math.abs(position - focus.primary.y) < reach ? 0 : 1
  }
}
