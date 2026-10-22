/**
 * `Lines`' end labels: which series carry one, and on which side of its last point it sits. Pure,
 * so the rules are tested without an engine; `endLabelMarks` is the only part that draws.
 */
import { decorative } from '@tanstack/charts/mark/decorative'
import { text } from '@tanstack/charts/text'
import { VX } from '../tokens'
import { rowX } from './types'
import type { ChartMarks, ChartSeries, ChartX, PlotContext, PlotRow } from './types'

const MAX_END_LABELS = 3
/** Two end labels closer than this (px, vertically) are pushed apart to it: one label line (11px at 1.35) plus a pixel of air. */
const END_LABEL_MIN_GAP = 15
const END_LABEL_DX = 6
/**
 * A glyph's advance as a share of the font size, for the room check. 0.85 covers proportional
 * Latin text, capitals included, in the shipped faces; a run of the widest capitals (`W`, `M` are
 * ~1 em) or a much wider face can still exceed it, so the estimate errs towards flipping: a label
 * that did not need to flip sits above its point, one that needed to and did not is cut.
 */
const END_LABEL_GLYPH_EM = 0.85
/** A label flipped inside the plot sits this far above (or, below its point, `BELOW`) its point. */
const END_LABEL_FLIP_DY = -9
const END_LABEL_FLIP_DY_BELOW = 13
/** The room a label's centre keeps from the plot's top and bottom edge, px: half its line. */
const END_LABEL_EDGE = 7

export type EndLabelAnchor = 'start' | 'end'
/** Which side of its line a flipped label sits: away from the line's last segment. */
export type EndLabelSide = 'above' | 'below'

/**
 * The side of its point an end label takes: `start` (right of the point) unless the point leaves
 * less room than the label needs. `fraction` is the point's x as a share of the plot width,
 * `plotWidth` the plot in px. Before the engine has measured the plot, `plotWidth` is the frame's,
 * which is wider than the plot by the axis gutters: the first frame can keep `start` for a label
 * the measured frame then flips.
 */
export function endLabelAnchor(opts: {
  fraction: number
  plotWidth: number
  label: string
  fontSize: number
}): EndLabelAnchor {
  const { fraction, plotWidth, label, fontSize } = opts
  const room = (1 - fraction) * plotWidth
  return room >= label.length * fontSize * END_LABEL_GLYPH_EM + END_LABEL_DX ? 'start' : 'end'
}

/** `Lines`' one naming switch: who names the series. */
export type LinesNaming = 'auto' | 'legend' | 'endLabels'

export type EndLabel<T, X extends ChartX> = {
  series: ChartSeries<T>
  row: PlotRow<T, X>
  anchor: EndLabelAnchor
  /** Only a flipped label (left of its point) can meet its own line; it takes the clear side. */
  side: EndLabelSide
  /** A vertical shift in px (negative is up) that keeps this label clear of its neighbours. */
  nudge: number
}

type LastPoint<T, X extends ChartX> = {
  series: ChartSeries<T>
  row: PlotRow<T, X>
  y: number
  fraction: number
  /** The value one finite point earlier: where the line's last segment comes from. */
  prev: number | null
}

/**
 * Pushes labels apart: `ys` are the labels' heights in px from the plot's bottom, returned as the
 * shift each needs (positive is up) so no two sit closer than {@link END_LABEL_MIN_GAP} and the
 * lowest and the topmost stay {@link END_LABEL_EDGE} inside the plot. Order is kept.
 */
export function spreadLabels(ys: readonly number[], plotHeight: number): number[] {
  const order = ys.map((y, i) => i).toSorted((a, b) => (ys[a] as number) - (ys[b] as number))
  const placed = new Map<number, number>()
  let floor = END_LABEL_EDGE
  for (const i of order) {
    const at = Math.max(ys[i] as number, floor)
    placed.set(i, at)
    floor = at + END_LABEL_MIN_GAP
  }
  // Pushed past the top: slide the whole stack back down, then re-sweep from the top.
  const top = plotHeight - END_LABEL_EDGE
  let ceiling = Infinity
  for (const i of order.toReversed()) {
    const at = Math.min(placed.get(i) as number, ceiling, top)
    placed.set(i, at)
    ceiling = at - END_LABEL_MIN_GAP
  }
  return ys.map((y, i) => (placed.get(i) as number) - y)
}

/**
 * The end labels to draw. `auto`: on the wide class only, with ≤ {@link MAX_END_LABELS} lines and
 * no right axis; `endLabels`: at every width and any line count (still no right axis, whose
 * series read another scale); `legend`: none. Labels that would collide are spread apart, never
 * dropped. A series whose last point the plot's own x scale cannot place, or places outside the plot
 * (`plot.xFraction` outside [0, 1]: clipped by a narrower `xDomain`), has no label.
 */
export function endLabelPlan<T, X extends ChartX>(
  plot: PlotContext<T, X>,
  lines: readonly ChartSeries<T>[],
  naming: LinesNaming = 'auto',
): EndLabel<T, X>[] {
  if (naming === 'legend' || plot.y2 !== undefined || lines.length === 0) return []
  if (naming === 'auto' && (plot.containerClass !== 'wide' || lines.length > MAX_END_LABELS))
    return []
  const last = lines.flatMap((series): LastPoint<T, X>[] => {
    const finite = plot.rows(series.key).filter((r) => r.y !== null)
    const row = finite.at(-1)
    if (row === undefined || row.y === null) return []
    const fraction = plot.xFraction(row.x)
    if (fraction === null || fraction < 0 || fraction > 1) return []
    return [{ series, row, y: row.y, fraction, prev: finite.at(-2)?.y ?? null }]
  })
  // No `y2` here (returned above), so every label reads the left domain.
  const [lo, hi] = plot.yDomain
  const anchors = last.map(({ series, fraction }) =>
    endLabelAnchor({
      fraction,
      plotWidth: plot.plotWidth,
      label: series.label,
      fontSize: VX.text.micro,
    }),
  )
  // Flipped labels (left of their point) sit over their own line, and between two close lines they
  // would sit on the neighbour's too: the lowest takes the side below its point, the rest above, so
  // the stack wraps the lines instead of filling the gap between them.
  const flipped = last.flatMap((p, i) => (anchors[i] === 'end' ? [i] : []))
  const lowest = flipped.length > 1 ? flipped.toSorted((a, b) => lineY(a) - lineY(b))[0] : undefined
  function lineY(i: number): number {
    return (last[i] as (typeof last)[number]).y
  }
  const placed = last.map(({ y, prev }, i) => {
    const anchor = anchors[i] as EndLabelAnchor
    // A line falling into its end point comes from above: alone, the label drops below it.
    const side =
      lowest !== undefined && anchor === 'end'
        ? i === lowest
          ? ('below' as const)
          : ('above' as const)
        : prev !== null && prev > y
          ? ('below' as const)
          : ('above' as const)
    // The label's centre, px from the plot's bottom, with its flip: what the spread keeps apart.
    const centre = ((y - lo) / (hi - lo || 1)) * plot.plotHeight - endLabelOffset(anchor, side).dy
    return { anchor, side, centre }
  })
  const shifts = spreadLabels(
    placed.map((p) => p.centre),
    plot.plotHeight,
  )
  return last.map(({ series, row }, i) => ({
    series,
    row,
    anchor: (placed[i] as (typeof placed)[number]).anchor,
    side: (placed[i] as (typeof placed)[number]).side,
    nudge: 0 - (shifts[i] as number),
  }))
}

/** The offset of a label from its point: right of it, level; or left of it, above or below. */
export function endLabelOffset(
  anchor: EndLabelAnchor,
  side: EndLabelSide = 'above',
): { dx: number; dy: number } {
  if (anchor === 'start') return { dx: END_LABEL_DX, dy: 0 }
  return { dx: -END_LABEL_DX, dy: side === 'above' ? END_LABEL_FLIP_DY : END_LABEL_FLIP_DY_BELOW }
}

export function endLabelMarks<T, X extends ChartX>(plan: readonly EndLabel<T, X>[]): ChartMarks {
  return plan.map(({ series, row, anchor, side, nudge }) =>
    decorative(
      text([row], {
        id: `${series.key}-end-label`,
        x: rowX,
        y: 'y',
        text: () => series.label,
        fill: series.color,
        fontSize: VX.text.micro,
        anchor,
        dx: endLabelOffset(anchor, side).dx,
        dy: endLabelOffset(anchor, side).dy + nudge,
      }),
    ),
  )
}
