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

/**
 * Distance from the plot edge to the near edge of a tick LABEL: visx's default `tickLength` (8)
 * plus the ±4 `dx` the themed axes in `primitives/Axes.tsx` apply. Kept in one place so the
 * measured gutter and the painted axis agree.
 */
const AXIS_TICK_GAP = 12

/** Line box of a single-line tick label at `fontPx`. */
const lineHeight = (fontPx: number): number => Math.ceil(fontPx * 1.35)

export type AutoMarginInput = {
  /** Left-axis tick labels, already formatted. */
  left?: readonly string[]
  /** Right-axis tick labels, already formatted. Presence (not a flag) is what widens `right`. */
  right?: readonly string[]
  /** X-axis tick labels, already formatted. */
  bottom?: readonly string[]
  /** Degrees of counter-clockwise rotation applied to the x tick labels. Default 0. */
  rotate?: number
  /** Tick-label font size. Default `VX.axisFont`. */
  fontPx?: number
  /** Explicit per-side overrides — applied LAST, so an escape hatch always wins. */
  override?: Partial<ChartMargin>
}

/**
 * Resolve the four margins from measured labels.
 *
 * Law, per side:
 * - `left` — widest left label + gap, floored at `VX.margin.left`.
 * - `right` — with a right axis: widest right label + gap. Without one: half the widest x label,
 *   so the LAST x tick (centered on the plot's right edge) cannot clip. Both floored at
 *   `VX.margin.right`.
 * - `bottom` — one label line (or the rotated bounding height) + gap, floored at
 *   `VX.margin.bottom`.
 * - `top` — `VX.margin.top`. Nothing measures into it; a chart that draws into the top gutter
 *   passes an override.
 */
export function autoMargin(input: AutoMarginInput = {}): ChartMargin {
  const fontPx = input.fontPx ?? VX.axisFont
  const { left = [], right = [], bottom = [], rotate = 0, override } = input

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

  return {
    top: override?.top ?? VX.margin.top,
    right:
      override?.right ??
      Math.ceil(
        Math.max(VX.margin.right, right.length > 0 ? rightWidth + AXIS_TICK_GAP : bottomWidth / 2),
      ),
    bottom: override?.bottom ?? Math.ceil(Math.max(VX.margin.bottom, bottomExtent + AXIS_TICK_GAP)),
    left:
      override?.left ??
      Math.ceil(Math.max(VX.margin.left, left.length > 0 ? leftWidth + AXIS_TICK_GAP : 0)),
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
}): { labels: string[]; format: (v: number) => string } {
  const probe = scaleLinear<number>({
    domain: opts.domain,
    range: [1, 0],
    ...(opts.nice === true && { nice: true }),
  })
  const format = opts.format ?? probe.tickFormat(opts.ticks)
  return { labels: probe.ticks(opts.ticks).map(format), format }
}
