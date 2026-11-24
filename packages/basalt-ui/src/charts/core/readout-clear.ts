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
import { measureChartText } from '../text-measure'

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
/** Air a band name's chip keeps from the tick labels beside it, px: a chip bolder than its tick never touches the neighbour the thinning placed against the regular name. */
const BAND_CHIP_GAP = 1
/** The inset the engine keeps between a readout and the chart's edge, px (`clampLabel`). */
const EDGE_INSET = 2
/** The weight of the crosshair's chip, which the engine draws bolder than a tick label. */
const CHIP_WEIGHT = 600

/** A centred caption's width as the engine measures it (its table plus the room a Linux Chrome adds), px: what its thinning placed the names apart by. */
const measuredWidth = (text: string, fontSize: number, fontWeight: number): number =>
  measureChartText(text, {
    fontSize,
    fontScale: 1,
    fontFamily: '',
    fontStyle: 'normal',
    fontStretch: 'normal',
    fontWeight,
    letterSpacing: 0,
    anchor: 'middle',
    baseline: 'middle',
    direction: 'ltr',
  }).width

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

/** One x tick label as the axis draws it: its value, its text, and the anchor and shift that move it off its tick. */
export type XTickLabel = {
  value: ChartValue
  text: string
  anchor: Anchor | undefined
  dx: number | undefined
}

const sameValue = (a: ChartValue, b: ChartValue): boolean =>
  a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b

/**
 * Whether the readout of `value` only repeats a tick label: a tick at the same value prints the same text
 * (a band axis names each band, so the focused band's own tick is its reading). The tick then stands as
 * the readout: no tick next to it is blanked for it, and a chart that cannot blank the tick draws no chip.
 */
export const chipRepeatsTick = (
  value: ChartValue,
  readoutText: string,
  ticks: readonly XTickLabel[],
): boolean => ticks.some((t) => sameValue(t.value, value) && t.text === readoutText)

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
  /** The axis' tick labels: a readout that only repeats one of them blanks none. */
  ticks?: readonly XTickLabel[] | undefined
}): (context: { value: ChartValue; position: number; focus: ReadoutFocus }) => number {
  const { tick, readoutText, fontSize, width, corner } = opts
  return ({ value, position, focus }) => {
    if (focus === null) return 1
    const { x, xValue } = focus.primary
    if (!Number.isFinite(x)) return 1
    const half = captionWidth(readoutText(xValue), fontSize) / 2
    // A readout that only repeats a tick of its own value sits exactly where that tick does: it replaces it
    // and a neighbour, which the thinning already holds apart from it, needs no air for it.
    const repeats =
      opts.ticks !== undefined && chipRepeatsTick(xValue, readoutText(xValue), opts.ticks)
    // A band name repeated as the readout is drawn where its tick is (a name, not a date or a number, whose
    // chip the engine pushes in from the chart edge).
    const band = repeats && typeof xValue === 'string'
    const centre =
      width === undefined || band
        ? x
        : clamp(x, EDGE_INSET + half, Math.max(EDGE_INSET + half, width - EDGE_INSET - half))
    const air = repeats ? (band ? BAND_CHIP_GAP : 0) : READOUT_AIR
    // A band name is measured as the engine measures it, the chip bold and the tick regular: the engine placed
    // the names apart at rest by those widths, and `captionWidth` over-estimates them, so on a phone it blanked
    // neighbours the chip never touches. Dates stay on the estimate: their labels are packed to the engine's
    // minimum gap, and a bold chip over one is the garbled string.
    const chipHalf = band ? measuredWidth(readoutText(xValue), fontSize, CHIP_WEIGHT) / 2 : half
    const readout: Span = [centre - chipHalf - air, centre + chipHalf + air]
    const label = spanOf(
      position + (tick.dx(value) ?? 0),
      band
        ? measuredWidth(tick.text(value), fontSize, 400)
        : captionWidth(tick.text(value), fontSize),
      tick.anchor(value) ?? 'middle',
    )
    if (meet(readout, label)) return 0
    // The chip prints the name its own tick prints, though it stands where the pointer is (over the bar of a
    // group, not its band's centre): that tick gives way, so the name is on screen once.
    if (repeats && sameValue(value, xValue) && tick.text(value) === readoutText(xValue)) return 0
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
 * Whether the x readout of `value` would cover one of the tick labels. The engine blanks a tick under the
 * readout only for a chart that holds the focus: a chart that merely follows the shared cursor (the
 * labelled pane under panes with no x axis, a chart the keys moved) is handed no focus, so its readout
 * is dropped where it would cover a tick. Positions are read from the axis' own shares of `plotWidth`.
 */
export function chipCoversTick(opts: {
  value: ChartValue
  readoutText: string
  fontSize: number
  plotWidth: number
  share: EdgeShare
  ticks: readonly XTickLabel[]
}): boolean {
  const { value, readoutText, fontSize, plotWidth, share, ticks } = opts
  const at = share(value)
  if (at === null || plotWidth <= 0) return false
  const half = captionWidth(readoutText, fontSize) / 2
  const readout: Span = [at * plotWidth - half - READOUT_AIR, at * plotWidth + half + READOUT_AIR]
  return ticks.some((tick) => {
    const position = share(tick.value)
    if (position === null) return false
    return meet(
      readout,
      spanOf(
        position * plotWidth + (tick.dx ?? 0),
        captionWidth(tick.text, fontSize),
        tick.anchor ?? 'middle',
      ),
    )
  })
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
  /** Where a label stands from its grid line, px: a label inside the plot is on the chip's row by its own place, not its line's. */
  shift?: ((position: number) => number) | undefined
}): (context: { value: ChartValue; position: number; focus: ReadoutFocus }) => number {
  const { fontSize, chip, corner, shift } = opts
  const reach = fontSize * LINE_BOX + READOUT_AIR
  return ({ value, position, focus }) => {
    if (focus === null) return 1
    if (
      chip &&
      Number.isFinite(focus.primary.y) &&
      Math.abs(position + (shift?.(position) ?? 0) - focus.primary.y) < reach
    )
      return 0
    return corner !== undefined &&
      corner.xChip?.() !== false &&
      inCorner(corner.x(focus.primary.xValue), CORNER_X) &&
      inCorner(corner.y(value), CORNER_Y)
      ? 0
      : 1
  }
}
