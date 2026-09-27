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
 * (`chartMetrics().axisFont`) so the spacing is derived from the size actually painted.
 */
export function xLabelPxFor(labels: string[], fontPx: number = VX.axisFont): number {
  return maxTextWidth(labels, fontPx) + X_TICK_LABEL_GAP
}

/**
 * The horizontal room one 45°-rotated x label takes: its projected box (`cos 45°` of the width plus
 * one line box) plus the gap. A tilted label still competes with its neighbour for this much, so
 * thinning by the bare `VX.minPxPerTick` floor let two of them touch as soon as the plot widened.
 */
export function rotatedXLabelPx(labels: string[], fontPx: number = VX.axisFont): number {
  return (
    Math.ceil(COS_45 * (maxTextWidth(labels, fontPx) + Math.ceil(fontPx * 1.35))) + X_TICK_LABEL_GAP
  )
}

/**
 * Pick evenly-spaced tick values that fit the available width.
 *
 * `labelPx` is the width one formatted label actually needs (measured, plus the gap it wants from
 * its neighbour) and REPLACES the `VX.minPxPerTick` constant whenever it is supplied, in either
 * direction — a wide label needs more room than the constant assumed (a `formatX` returning
 * `Mar 08 14:00` used to overlap at every width, the one side of the chart that did not follow
 * §1's "measure what you paint" law), and a narrow one (single-digit band labels) can pack in
 * MORE ticks than the constant would allow, which the floor used to suppress (R2C-11). Omit it and
 * the constant is what governs, same as before.
 *
 * The final key is still appended when the step misses the last index — a thinned axis would
 * otherwise paint no label at the right edge at all — but it no longer prints ON TOP of its
 * neighbour. An appended tick lands a PARTIAL step from the last one on the grid, so at any tick
 * count wide enough labels overlap there; measured at `/charts-stress` block (f1), `Mar 13 14:00`
 * and `Mar 14 14:00` printed over each other at 1440px. When that gap is narrower than one label,
 * the grid tick before it is dropped instead.
 *
 * `anchorTerminals` (default false) mirrors the SAME flag `autoMargin`/`Axes.tsx` take: when the
 * axis anchors index 0 and the last index at their TEXT edge rather than their centre
 * (`terminalAnchor`), each reaches a FULL label's width toward its neighbour instead of half, so
 * the plain per-tick pitch above (sized for two centred labels) isn't enough at either boundary —
 * `Bars` with 30 daily "Jan DD HH:MM" keys overlapped there at phone width even though the interior
 * pitch was fine (R2C-6). The SAME rule then applies, symmetrically, to the tick right after
 * index 0. 1.5× is a deliberately generous (cheap, simple) stand-in for "one label plus half a
 * label" rather than measuring the split precisely; it's skipped when `labelPx` is only the bare
 * `VX.minPxPerTick` floor, which has no relationship to how wide a label actually is. Index 0
 * always survives (never the one dropped here) and `last` is always (re-)added below, so dropping
 * any OTHER index never breaks the "at least 2 ticks" floor.
 */
export function smartTicks(
  dates: string[],
  xMax: number,
  labelPx?: number,
  anchorTerminals = false,
): string[] {
  if (dates.length === 0) return []
  // A non-positive `labelPx` (a caller's own arithmetic gone wrong, or an explicit 0) is not "no
  // measurement" — `labelPx ?? VX.minPxPerTick` let it through as-is, and `xMax / 0` then floors
  // `maxTicks` to `Infinity`, which used to make EVERY tick "fit" and skip thinning entirely.
  const perTick = labelPx !== undefined && labelPx > 0 ? labelPx : VX.minPxPerTick
  const maxTicks = Math.max(2, Math.floor(xMax / perTick))
  const last = dates.length - 1
  // `scalePoint({ padding: 0.5 })` spreads N points over `xMax`, so one index is `xMax / N` wide.
  const pxPerIndex = dates.length > 0 ? xMax / dates.length : 0
  // Only a REAL measured label (not the bare `VX.minPxPerTick` floor, which knows nothing about how
  // wide a label actually is) earns the wider terminal clearance below.
  const anchored = anchorTerminals && labelPx !== undefined && labelPx > 0

  const keep = new Set<number>()
  if (dates.length <= maxTicks) {
    // Every date already fits with no thinning — round 3: this used to `return dates` here,
    // skipping the terminal-clearance pass below entirely. A terminal-anchored label still reaches
    // a FULL label's width toward its neighbour (not half, like a centred one), which the plain
    // per-tick spacing above does not itself guarantee, so the same pass has to run here too.
    for (let i = 0; i <= last; i += 1) keep.add(i)
  } else {
    const step = Math.ceil(dates.length / maxTicks)
    for (let i = 0; i <= last; i += step) keep.add(i)

    const BOUNDARY_FACTOR = 1.5
    const boundaryPx = anchored ? perTick * BOUNDARY_FACTOR : perTick
    // The final key is appended unconditionally, even when the step misses it — but only dropping
    // the grid tick right before it when the two would otherwise sit closer than one tick's width.
    // This is the "would an APPEND overlap" concern; it does nothing when the step already lands on
    // `last` (nothing is being appended), which is the gap the anchored pass below closes.
    const lastOnGrid = Math.floor(last / step) * step
    if (lastOnGrid !== last) {
      const gapPx = (last - lastOnGrid) * pxPerIndex
      if (lastOnGrid > 0 && gapPx > 0 && gapPx < boundaryPx) keep.delete(lastOnGrid)
      keep.add(last)
    }
  }

  if (anchored && keep.size > 1) {
    const BOUNDARY_FACTOR = 1.5
    const boundaryPx = perTick * BOUNDARY_FACTOR
    // START: the kept index right after 0 needs a FULL label's clearance from it, not the plain
    // per-tick pitch a centred label would settle for.
    const sorted = [...keep].toSorted((a, b) => a - b)
    const second = sorted[1]
    if (second !== undefined && second !== last && second * pxPerIndex < boundaryPx) {
      keep.delete(second)
    }
    // END: the same check, mirrored, against whatever is now the second-to-last kept index —
    // computed AFTER the START drop above (not from the original grid), and unconditional of
    // whether `last` was naturally on the grid or had to be appended (round 3's fix: previously this
    // only ran inside the `lastOnGrid !== last` branch above, so a grid that already landed on
    // `last` skipped it — the 13-dates/60px-label/260px-width counter-example this closes: step 4
    // lands on index 12, leaving its neighbour at index 8 only 80px away, under the 90px a
    // full-width terminal label needs).
    const afterHead = [...keep].toSorted((a, b) => a - b)
    const secondLast = afterHead[afterHead.length - 2]
    if (
      secondLast !== undefined &&
      secondLast !== 0 &&
      (last - secondLast) * pxPerIndex < boundaryPx
    ) {
      keep.delete(secondLast)
    }
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
