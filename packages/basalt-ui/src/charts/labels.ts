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
/** Below this vertical gap two end labels would collide; then none is drawn. */
const END_LABEL_MIN_GAP = 13
const END_LABEL_DX = 6
/**
 * A glyph's advance as a share of the font size, for the room check. 0.85 covers proportional
 * Latin text, capitals included, in the shipped faces; a run of the widest capitals (`W`, `M` are
 * ~1 em) or a much wider face can still exceed it, so the estimate errs towards flipping: a label
 * that did not need to flip sits above its point, one that needed to and did not is cut.
 */
const END_LABEL_GLYPH_EM = 0.85
/** A label flipped inside the plot sits this far above its point. */
const END_LABEL_FLIP_DY = -9

export type EndLabelAnchor = 'start' | 'end'

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

export type EndLabel<T, X extends ChartX> = {
  series: ChartSeries<T>
  row: PlotRow<T, X>
  anchor: EndLabelAnchor
}

type LastPoint<T, X extends ChartX> = {
  series: ChartSeries<T>
  row: PlotRow<T, X>
  y: number
  fraction: number
}

/**
 * The end labels to draw: none off the wide class, with a right axis, with more than
 * {@link MAX_END_LABELS} lines, or when two would collide in pixels (against the plot's height).
 * A series whose last point the plot's own x scale cannot place, or places outside the plot
 * (`plot.xFraction` outside [0, 1]: clipped by a narrower `xDomain`), has no label.
 */
export function endLabelPlan<T, X extends ChartX>(
  plot: PlotContext<T, X>,
  lines: readonly ChartSeries<T>[],
): EndLabel<T, X>[] {
  if (plot.containerClass !== 'wide' || plot.y2 !== undefined) return []
  if (lines.length === 0 || lines.length > MAX_END_LABELS) return []
  const last = lines.flatMap((series): LastPoint<T, X>[] => {
    const row = plot.rows(series.key).findLast((r) => r.y !== null)
    if (row === undefined || row.y === null) return []
    const fraction = plot.xFraction(row.x)
    if (fraction === null || fraction < 0 || fraction > 1) return []
    return [{ series, row, y: row.y, fraction }]
  })
  // Collision check in pixels from the plot height: labels that would overlap are not drawn at all.
  // No `y2` here (returned above), so every label reads the left domain.
  const [lo, hi] = plot.yDomain
  const ys = last
    .map(({ y }) => ((y - lo) / (hi - lo || 1)) * plot.plotHeight)
    .toSorted((a, b) => a - b)
  if (ys.some((y, i) => i > 0 && y - (ys[i - 1] as number) < END_LABEL_MIN_GAP)) return []
  return last.map(({ series, row, fraction }) => ({
    series,
    row,
    anchor: endLabelAnchor({
      fraction,
      plotWidth: plot.plotWidth,
      label: series.label,
      fontSize: VX.text.micro,
    }),
  }))
}

/** The offset of a label from its point: right of it, level; or left of it and above. */
export function endLabelOffset(anchor: EndLabelAnchor): { dx: number; dy: number } {
  return anchor === 'end'
    ? { dx: -END_LABEL_DX, dy: END_LABEL_FLIP_DY }
    : { dx: END_LABEL_DX, dy: 0 }
}

export function endLabelMarks<T, X extends ChartX>(plan: readonly EndLabel<T, X>[]): ChartMarks {
  return plan.map(({ series, row, anchor }) =>
    decorative(
      text([row], {
        id: `${series.key}-end-label`,
        x: rowX,
        y: 'y',
        text: () => series.label,
        fill: series.color,
        fontSize: VX.text.micro,
        anchor,
        ...endLabelOffset(anchor),
      }),
    ),
  )
}
