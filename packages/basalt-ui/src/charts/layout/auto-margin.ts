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
 *   projection — see {@link rotatedLeftOverhang}.
 * - `right` — with a right axis: widest right label + gap. Without one, and the x labels are NOT
 *   rotated: half the widest x label, so the LAST x tick (centered on the plot's right edge)
 *   cannot clip. Without one AND rotated: nothing — a rotated label is anchored at its right edge
 *   (`textAnchor: 'end'`, same as {@link rotatedLeftOverhang}), so it hangs left of its tick, not
 *   right, and reserving half its width would pad a side nothing paints into. Every case is
 *   floored at `VX.margin.right`.
 * - `bottom` — one label line (or the rotated bounding height) + gap, floored at
 *   `VX.margin.bottom`.
 * - `top` — `VX.margin.top`. Nothing measures into it; a chart that draws into the top gutter
 *   passes an override.
 */
export function autoMargin(input: AutoMarginInput = {}): ChartMargin {
  const fontPx = input.fontPx ?? VX.axisFont
  const { left = [], right = [], bottom = [], rotate = 0, floor = VX.margin, override } = input

  const leftWidth = maxTextWidth(left, fontPx)
  const rightWidth = maxTextWidth(right, fontPx)
  const bottomWidth = maxTextWidth(bottom, fontPx)

  const radians = (rotate * Math.PI) / 180
  const bottomExtent =
    rotate === 0
      ? lineHeight(fontPx)
      : Math.ceil(
          Math.abs(bottomWidth * Math.sin(radians)) +
            Math.abs(lineHeight(fontPx) * Math.cos(radians)),
        )

  /**
   * How far a rotated x label reaches LEFT of its own tick.
   *
   * `AxisBottomDate` anchors a rotated label at its right edge (`textAnchor: 'end'`) and rotates it
   * counter-clockwise, so the string runs down-and-to-the-LEFT from the tick it belongs to. The
   * FIRST tick sits at the plot's left edge, so its label hangs into the left gutter and, at
   * `VX.margin.left`, straight off the chart — visible at `/charts-stress` block (f2), where
   * `Mar 01 14:00` printed as `ar 01 14:00`.
   *
   * The projection is `width · cos(angle)`: 0.71× the label at 45°, and zero at 90°, where the
   * string runs straight down and costs no horizontal room at all. This is the same
   * measured-not-assumed law the bottom gutter already followed — the left side simply never got
   * its half. Nothing moves for an unrotated axis.
   */
  const rotatedLeftOverhang = rotate === 0 ? 0 : Math.abs(bottomWidth * Math.cos(radians))

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
    bottom: override?.bottom ?? Math.ceil(Math.max(floor.bottom, bottomExtent + AXIS_TICK_GAP)),
    left:
      override?.left ??
      Math.ceil(
        Math.max(floor.left, left.length > 0 ? leftWidth + AXIS_TICK_GAP : 0, rotatedLeftOverhang),
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
