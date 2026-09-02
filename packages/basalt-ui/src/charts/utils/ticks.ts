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

/**
 * Which of a BAND axis's category labels may be painted so that no two neighbours overlap — the
 * same measured law {@link smartTicks} applies to a point axis, for a chart that lays its labels
 * out itself instead of through the `Axis*` primitives.
 *
 * `Heatmap` was the one kind rendering labels as plain `<text>`, and therefore the one kind exempt
 * from §1's measured-margin law: it printed all 12 columns at 390px, ten of them overlapping. Here
 * `bandPx` is the pitch between two neighbouring labels (a cell's width for columns, its height for
 * rows) and `labelPx` the room one label needs ({@link xLabelPxFor} for a horizontal run, the line
 * box for a vertical one); a label is kept every `ceil(labelPx / bandPx)` bands, so the gap between
 * two painted labels is never narrower than one label.
 *
 * The first and last band always keep theirs — they are the two a reader orients from — and when
 * the last one lands a partial step from the grid, the grid label before it is dropped rather than
 * printed underneath, exactly as `smartTicks` does with its appended final tick.
 */
export function thinLabels(
  labels: readonly string[],
  bandPx: number,
  labelPx: number,
): Set<number> {
  const keep = new Set<number>()
  const last = labels.length - 1
  if (last < 0) return keep
  keep.add(0)
  if (last === 0) return keep
  if (bandPx <= 0 || labelPx <= 0) {
    keep.add(last)
    return keep
  }
  const step = Math.max(1, Math.ceil(labelPx / bandPx))
  for (let i = 0; i <= last; i += step) keep.add(i)
  const lastOnGrid = Math.floor(last / step) * step
  if (lastOnGrid !== last && lastOnGrid > 0 && (last - lastOnGrid) * bandPx < labelPx) {
    keep.delete(lastOnGrid)
  }
  keep.add(last)
  return keep
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

/** Horizontal projection of a 45°-rotated label — `cos 45°`. A tilted label still competes for
 * horizontal room, just for `0.71×` of it. */
const COS_45 = Math.SQRT1_2

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
 *
 * **Wanting to rotate is not the same as rotating fitting.** A rotated label reaches into the LEFT
 * gutter (`rotatedLabelExtents`), so rotating BUYS bottom-gutter depth and SPENDS plot width — and
 * at a narrow enough box it spends more than it buys. `/charts-stress` block (f1) is the case:
 * three clean horizontal labels at 390, and at 320 an auto-rotation that reached off the left edge
 * and bought not one extra label for it. So the trade is CHECKED, not assumed. Pass `rotatedXMax`
 * (the width left once `autoMargin({ rotate: 45 })` has taken its deeper left gutter) and the
 * rotation is taken only when the rotated axis paints MORE labels than the flat one at its
 * projected pitch (`labelPx · cos 45°`), and at least two of them. Otherwise the axis stays flat
 * and `smartTicks` thins further — two readable horizontal labels beat two tilted ones in a
 * narrower plot. Omit `rotatedXMax` and the check is skipped.
 */
export function autoXLabelRotate(input: {
  tier: ChartTier
  /** Plot width available to the x axis, from the UNROTATED margin. */
  xMax: number
  /** What one x label needs horizontally ({@link xLabelPxFor}). */
  labelPx: number
  /** Plot width that would REMAIN once the rotated margin takes its deeper left gutter
   * (`autoMargin({ rotate: 45 })`). Omit to skip the fit check. */
  rotatedXMax?: number
}): 0 | 45 {
  const { tier, xMax, labelPx, rotatedXMax } = input
  if (tier !== 'phone') return 0
  if (labelPx <= 0 || xMax <= 0) return 0
  const flatLabels = Math.floor(xMax / labelPx)
  if (flatLabels >= MIN_HORIZONTAL_TICKS) return 0
  if (rotatedXMax === undefined) return 45
  const rotatedLabels = Math.floor(rotatedXMax / (labelPx * COS_45))
  return rotatedLabels >= 2 && rotatedLabels > flatLabels ? 45 : 0
}
