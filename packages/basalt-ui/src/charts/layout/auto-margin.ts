/**
 * Plot-rect margins derived from the labels that will actually be painted.
 *
 * `VX.margin` is a static token, so charts used to clip (or get hand-nudged) whenever a tick label
 * outgrew it — the "I always push the charts around" failure mode. Here the token becomes a
 * FLOOR: a measured side may only ever grow past it, never shrink below it, so no chart gets
 * tighter than it was, and a wide label widens its own gutter automatically.
 *
 * See `docs/CHARTS-SPEC.md` §1.
 */

import { scaleLinear } from '@visx/scale'
import { VX } from '../../tokens'
import type { ChartMargin } from '../../tokens'
import { maxTextWidth } from '../utils/measure-text'
import { logTickValues, niceLogDomain } from './log-ticks'

/**
 * Distance from the plot edge to the near edge of a tick LABEL: visx's default `tickLength` (8)
 * plus the ±4 `dx` the themed axes in `primitives/Axes.tsx` apply. Kept in one place so the
 * measured gutter and the painted axis agree.
 */
const AXIS_TICK_GAP = 12

/** Line box of a single-line tick label at `fontPx`. */
const lineHeight = (fontPx: number): number => Math.ceil(fontPx * 1.35)

/**
 * The line box split at the baseline. Only the DESCENT falls below it and only the ASCENT reaches
 * back over the anchor, and a rotated label needs the two apart — its box is measured from the
 * baseline point the axis anchors it at, not from a centred line box. The two ratios sum to
 * {@link lineHeight}'s 1.35em, so nothing moves for the unrotated case.
 */
const DESCENT_RATIO = 0.3
const descent = (fontPx: number): number => fontPx * DESCENT_RATIO
const ascent = (fontPx: number): number => lineHeight(fontPx) - descent(fontPx)

/**
 * visx's own `tickLength` (`@visx/axis`'s `Axis` default) and the extra drop `Ticks` applies to a
 * bottom-axis label — `to.y + max(10, fontSize)`. Together they are the distance from the axis LINE
 * to the tick label's BASELINE, which is where a rotated label's box is measured from.
 */
const AXIS_TICK_LENGTH = 8
const VISX_MIN_LABEL_FONT = 10

/**
 * The `dx`/`dy` nudge `primitives/Axes.tsx` paints a rotated tick label through — the d3 idiom
 * that puts a 45° label under its tick's lower-left and centres a 90° one on its vertical line.
 *
 * It lives HERE, and the axis imports it, because it is the one number that must be in both
 * places: the nudge was applied at paint and absent from the measure, so §1's measured-equals-
 * painted law broke in exactly the rotated case §8 introduced (the first label crossed the SVG's
 * left edge by 3.2px at 390 and 5.7px at 320, and every rotated label's descender row sat on the
 * bottom clip line). Move a value here and the gutter moves with it.
 */
export const ROTATED_LABEL_OFFSET: Record<45 | 90, { dx: number; dy: number }> = {
  45: { dx: -6, dy: 2 },
  90: { dx: -4, dy: 4 },
}

/** Breathing room between a rotated label's painted box and the SVG's own clip edge. One px reads
 * as flush; two is the smallest gap that reads as deliberate. */
const ROTATED_CLEARANCE = 2

const rotatedOffset = (rotate: number): { dx: number; dy: number } =>
  ROTATED_LABEL_OFFSET[rotate as 45 | 90] ?? { dx: 0, dy: 0 }

/**
 * How far a rotated x label reaches LEFT of the plot's left edge, and how far BELOW the axis line —
 * measured from the baseline point the axis anchors it at, through the same `dx`/`dy` the axis
 * paints it with.
 *
 * `AxisBottomDate` anchors a rotated label at its right edge (`textAnchor: 'end'`) and rotates it
 * counter-clockwise about that point, so the string runs down-and-to-the-LEFT from the tick it
 * belongs to. The FIRST tick sits at the plot's left edge, so its label hangs into the left gutter;
 * the LAST row of glyphs hangs below the axis. Rotating the label's box about its anchor gives both
 * extents exactly:
 *
 * - left  = `cos θ · (width + ascent) − dx`  — zero at 90°, where the string runs straight down.
 * - below = `tickLength + max(10, fontPx) + dy + sin θ · width + cos θ · descent`.
 *
 * Both carry {@link ROTATED_CLEARANCE} so the painted box clears the SVG's clip rather than
 * touching it.
 */
export function rotatedLabelExtents(input: {
  /** Width of the widest x tick label, already measured at the painted font. */
  labelWidth: number
  fontPx: number
  rotate: number
}): { left: number; below: number } {
  const { labelWidth, fontPx, rotate } = input
  if (rotate === 0) return { left: 0, below: 0 }
  const radians = (rotate * Math.PI) / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  const { dx, dy } = rotatedOffset(rotate)
  return {
    left: cos * (labelWidth + ascent(fontPx)) - dx + ROTATED_CLEARANCE,
    below:
      AXIS_TICK_LENGTH +
      Math.max(VISX_MIN_LABEL_FONT, fontPx) +
      dy +
      sin * labelWidth +
      cos * descent(fontPx) +
      ROTATED_CLEARANCE,
  }
}

/**
 * The grouped-thousands default for a log axis with no explicit `format` — parity with the linear
 * branch's own `probe.tickFormat(ticks)`, which already groups (`"100,000"`). Unbounded fraction
 * digits (rather than `toLocaleString`'s default of 3) so a sub-unit log tick (`1e-7`) still prints
 * its digits instead of truncating to `"0"`.
 */
const LOG_TICK_FORMAT = new Intl.NumberFormat('en-US', { maximumFractionDigits: 20 })

export type AutoMarginInput = {
  /** Left-axis tick labels, already formatted. */
  left?: readonly string[]
  /** Right-axis tick labels, already formatted. Presence (not a flag) is what widens `right`. */
  right?: readonly string[]
  /** X-axis tick labels, already formatted. */
  bottom?: readonly string[]
  /** Degrees of counter-clockwise rotation applied to the x tick labels. Default 0. */
  rotate?: number
  /** Tick-label font size. Default `VX.axisFont`. A phone-tier chart passes its own smaller size
   * (`chartTierMetrics().axisFont`) — the measured label must be the painted label. */
  fontPx?: number
  /**
   * Per-side FLOORS. Default `VX.margin`. The phone tier passes its tightened set
   * (`chartTierMetrics().margin`) so a static 44px left gutter does not spend an eighth of a 360px
   * chart on a three-character label. The law itself does not move: a side may still only ever
   * grow past its floor.
   */
  floor?: ChartMargin
  /** Explicit per-side overrides — applied LAST, so an escape hatch always wins. */
  override?: Partial<ChartMargin>
}

/**
 * Resolve the four margins from measured labels.
 *
 * Law, per side (the floors are `VX.margin` by default; a tier may tighten them via `floor`):
 * - `left` — widest left label + gap, floored at `VX.margin.left`. When the x labels are ROTATED
 *   they also reach into this gutter, so the left side additionally clears their leftward
 *   extent — see {@link rotatedLabelExtents}.
 * - `right` — with a right axis: widest right label + gap. Without one, and the x labels are NOT
 *   rotated: half the widest x label, so the LAST x tick (centered on the plot's right edge)
 *   cannot clip. Without one AND rotated: nothing — a rotated label is anchored at its right edge
 *   (`textAnchor: 'end'`, same as {@link rotatedLabelExtents}), so it hangs left of its tick, not
 *   right, and reserving half its width would pad a side nothing paints into. Every case is
 *   floored at `VX.margin.right`.
 * - `bottom` — one label line + gap; when ROTATED, the label's measured drop below the axis line
 *   ({@link rotatedLabelExtents}) instead. Floored at `VX.margin.bottom`.
 * - `top` — `VX.margin.top`. Nothing measures into it; a chart that draws into the top gutter
 *   passes an override.
 */
export function autoMargin(input: AutoMarginInput = {}): ChartMargin {
  const fontPx = input.fontPx ?? VX.axisFont
  const { left = [], right = [], bottom = [], rotate = 0, floor = VX.margin, override } = input

  const leftWidth = maxTextWidth(left, fontPx)
  const rightWidth = maxTextWidth(right, fontPx)
  const bottomWidth = maxTextWidth(bottom, fontPx)

  // Measured EXACTLY as painted: through the same `dx`/`dy` `primitives/Axes.tsx` nudges a rotated
  // label by, and from the baseline the axis anchors it at.
  const rotated = rotatedLabelExtents({ labelWidth: bottomWidth, fontPx, rotate })
  const bottomExtent = rotate === 0 ? lineHeight(fontPx) + AXIS_TICK_GAP : rotated.below

  return {
    top: override?.top ?? floor.top,
    right:
      override?.right ??
      Math.ceil(
        Math.max(
          floor.right,
          right.length > 0 ? rightWidth + AXIS_TICK_GAP : rotate === 0 ? bottomWidth / 2 : 0,
        ),
      ),
    bottom: override?.bottom ?? Math.ceil(Math.max(floor.bottom, bottomExtent)),
    left:
      override?.left ??
      Math.ceil(
        Math.max(floor.left, left.length > 0 ? leftWidth + AXIS_TICK_GAP : 0, rotated.left),
      ),
  }
}

/**
 * The tick labels a linear axis WILL paint, derived before the plot rect exists.
 *
 * This is what breaks the margin/scale circularity: a linear scale's tick VALUES depend only on
 * its domain, so a throwaway-range probe yields the exact label strings {@link autoMargin} needs
 * to measure — and returning the resolved `format` alongside them guarantees the measured string
 * and the painted string are the same one. Shared by `CartesianChart` and by hand-composed kinds
 * (`DualPanel`) so the two can't drift.
 */
export function probeAxisLabels(opts: {
  domain: [number, number]
  ticks: number
  /** Overrides d3's own tick format. */
  format?: (v: number) => string
  /** Must match the real scale's `nice` — niceing changes which ticks exist. */
  nice?: boolean
  /** `'log'` measures through {@link logTickValues} instead of a linear probe scale — the same
   * helper the axis paints from (CHARTS-SPEC §1: measured labels == painted labels). Default
   * `'linear'`. */
  scale?: 'linear' | 'log'
}): { labels: string[]; format: (v: number) => string } {
  if (opts.scale === 'log') {
    const domain = opts.nice === true ? niceLogDomain(opts.domain) : opts.domain
    const format = opts.format ?? ((v: number) => LOG_TICK_FORMAT.format(v))
    return { labels: logTickValues(domain, opts.ticks).map(format), format }
  }
  const probe = scaleLinear<number>({
    domain: opts.domain,
    range: [1, 0],
    ...(opts.nice === true && { nice: true }),
  })
  const format = opts.format ?? probe.tickFormat(opts.ticks)
  return { labels: probe.ticks(opts.ticks).map(format), format }
}
