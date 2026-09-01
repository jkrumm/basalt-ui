import { VX } from '../../tokens'
import { maxTextWidth } from './measure-text'

/** The gap one x tick label wants from its neighbour, on top of its measured width. */
const X_TICK_LABEL_GAP = 8

/**
 * The horizontal room one x tick label needs: the widest string in `labels`, plus breathing space
 * to its neighbour. Feeds `smartTicks`, which otherwise thinned the axis by a constant that knew
 * nothing about what was actually painted (`docs/CHARTS-SPEC.md` §1). Shared by `CartesianChart`,
 * `useBandPlot` and `DualPanel` — the three call sites that used to reimplement this formula.
 */
export function xLabelPxFor(labels: string[]): number {
  return maxTextWidth(labels, VX.axisFont) + X_TICK_LABEL_GAP
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
 * The final key is appended unconditionally, so the result can carry one tick more than the width
 * strictly allows: a thinned axis whose step misses the last index would otherwise paint no label
 * at the right edge at all.
 */
export function smartTicks(dates: string[], xMax: number, labelPx?: number): string[] {
  if (dates.length === 0) return []
  const perTick = Math.max(VX.minPxPerTick, labelPx ?? 0)
  const maxTicks = Math.max(2, Math.floor(xMax / perTick))
  if (dates.length <= maxTicks) return dates
  const step = Math.ceil(dates.length / maxTicks)
  return dates.filter((_, i) => i % step === 0 || i === dates.length - 1)
}

/** Variant of smartTicks that targets an exact tick count rather than deriving from width. */
export function smartTicksEvery(dates: string[], count: number): string[] {
  if (dates.length === 0) return []
  if (dates.length <= count) return dates
  const step = Math.ceil(dates.length / count)
  return dates.filter((_, i) => i % step === 0 || i === dates.length - 1)
}
