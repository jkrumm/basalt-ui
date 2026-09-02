import { VX } from '../../tokens'
import type { ChartTier } from '../primitives/chart-frame-layout'
import { maxTextWidth } from './measure-text'

/** The gap one x tick label wants from its neighbour, on top of its measured width. */
const X_TICK_LABEL_GAP = 8

/**
 * The horizontal room one x tick label needs: the widest string in `labels`, plus breathing space
 * to its neighbour. Feeds `smartTicks`, which otherwise thinned the axis by a constant that knew
 * nothing about what was actually painted (`docs/CHARTS-SPEC.md` §1). Shared by `CartesianChart`,
 * `useBandPlot` and `DualPanel` — the three call sites that used to reimplement this formula.
 *
 * `fontPx` defaults to `VX.axisFont`; a phone-tier chart passes its own smaller tick font
 * (`chartTierMetrics().axisFont`) so the spacing is derived from the size actually painted.
 */
export function xLabelPxFor(labels: string[], fontPx: number = VX.axisFont): number {
  return maxTextWidth(labels, fontPx) + X_TICK_LABEL_GAP
}

/**
 * Pick evenly-spaced tick values that fit the available width.
 *
 * `labelPx` is the width one formatted label actually needs (measured, plus the gap it wants from
 * its neighbour) and overrides the `VX.minPxPerTick` floor whenever it is wider. Without it the
 * spacing came from that constant alone regardless of what was painted, so a `formatX` returning
 * `Mar 08 14:00` overlapped at every width — the one side of the chart that did not follow §1's
 * "measure what you paint" law. Omit it and nothing moves.
 *
 * The final key is still appended when the step misses the last index — a thinned axis would
 * otherwise paint no label at the right edge at all — but it no longer prints ON TOP of its
 * neighbour. An appended tick lands a PARTIAL step from the last one on the grid, so at any tick
 * count wide enough labels overlap there; measured at `/charts-stress` block (f1), `Mar 13 14:00`
 * and `Mar 14 14:00` printed over each other at 1440px. When that gap is narrower than one label,
 * the grid tick before it is dropped instead. Index 0 is never dropped: the left edge is the one
 * label a reader orients from.
 */
export function smartTicks(dates: string[], xMax: number, labelPx?: number): string[] {
  if (dates.length === 0) return []
  const perTick = Math.max(VX.minPxPerTick, labelPx ?? 0)
  const maxTicks = Math.max(2, Math.floor(xMax / perTick))
  if (dates.length <= maxTicks) return dates
  const step = Math.ceil(dates.length / maxTicks)
  const last = dates.length - 1

  const keep = new Set<number>()
  for (let i = 0; i <= last; i += step) keep.add(i)

  const lastOnGrid = Math.floor(last / step) * step
  if (lastOnGrid !== last) {
    // `scalePoint({ padding: 0.5 })` spreads N points over `xMax`, so one index is `xMax / N` wide.
    const pxPerIndex = dates.length > 0 ? xMax / dates.length : 0
    const gapPx = (last - lastOnGrid) * pxPerIndex
    if (lastOnGrid > 0 && gapPx > 0 && gapPx < perTick) keep.delete(lastOnGrid)
    keep.add(last)
  }

  return dates.filter((_, i) => keep.has(i))
}

/** Variant of smartTicks that targets an exact tick count rather than deriving from width. */
export function smartTicksEvery(dates: string[], count: number): string[] {
  if (dates.length === 0) return []
  if (dates.length <= count) return dates
  const step = Math.ceil(dates.length / count)
  return dates.filter((_, i) => i % step === 0 || i === dates.length - 1)
}

/**
 * The fewest x ticks an axis may thin down to before rotating is the cheaper trade. Two ticks
 * (`smartTicks`' own floor) is a labelled left edge and a labelled right edge and nothing to read
 * between them — at that point the axis has stopped being an axis.
 */
const MIN_HORIZONTAL_TICKS = 3

/**
 * The phone tier's default x-label rotation: 45° when the labels are so wide that fewer than
 * {@link MIN_HORIZONTAL_TICKS} of them fit side by side, else none.
 *
 * `xLabelRotate` already existed as the answer to a `formatX` too wide to repeat horizontally
 * (`docs/CHARTS-SPEC.md` §1) — it just had to be reached for by hand, per chart, by someone who
 * had already seen it collide on a phone. This makes it the DEFAULT at phone width and only there:
 * rotating trades horizontal crowding for bottom-gutter depth, which is the cheap axis on a narrow
 * viewport and the expensive one on a wide screen that had room all along. Opt out with an
 * explicit `xLabelRotate: 0`.
 *
 * Deliberately measured against the same `labelPx` `smartTicks` thins by, so the decision and the
 * thinning cannot disagree about how wide a label is.
 */
export function autoXLabelRotate(input: {
  tier: ChartTier
  /** Plot width available to the x axis, from the UNROTATED margin. */
  xMax: number
  /** What one x label needs horizontally ({@link xLabelPxFor}). */
  labelPx: number
}): 0 | 45 {
  const { tier, xMax, labelPx } = input
  if (tier !== 'phone') return 0
  if (labelPx <= 0 || xMax <= 0) return 0
  return Math.floor(xMax / labelPx) < MIN_HORIZONTAL_TICKS ? 45 : 0
}
