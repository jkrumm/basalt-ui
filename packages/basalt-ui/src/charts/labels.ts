/**
 * `Lines`' end labels: which series carry one, and on which side of its last point it sits. Pure,
 * so the rules are tested without an engine; `endLabelMarks` is the only part that draws.
 */
import { decorative } from '@tanstack/charts/mark/decorative'
import { text } from '@tanstack/charts/text'
import { VX } from '../tokens'
import { xFractionIn } from './scales'
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
 * The side of its point an end label takes. `start` (right of the point) unless the point is
 * KNOWN to leave less room than the label needs: `fraction` is the point's x as a share of the
 * plot width (`null`: unknown, as on a string x — keep the default), `plotWidth` the plot in px.
 * Before the engine has measured the plot, `plotWidth` is the frame's, which is wider than the plot
 * by the axis gutters: the first frame can keep `start` for a label the measured frame then flips.
 */
export function endLabelAnchor(opts: {
  fraction: number | null
  plotWidth: number
  label: string
  fontSize: number
}): EndLabelAnchor {
  const { fraction, plotWidth, label, fontSize } = opts
  if (fraction === null || !Number.isFinite(fraction)) return 'start'
  const room = (1 - fraction) * plotWidth
  return room >= label.length * fontSize * END_LABEL_GLYPH_EM + END_LABEL_DX ? 'start' : 'end'
}

export type EndLabel<T, X extends ChartX> = {
  series: ChartSeries<T>
  row: PlotRow<T, X>
  anchor: EndLabelAnchor
}

/**
 * The end labels to draw: none off the wide class, with a right axis, with more than
 * {@link MAX_END_LABELS} lines, or when two would collide in pixels. The room is read through the
 * x mapping the plot uses (`xDomain`, else the extent of every datum), not the labelled rows'.
 */
export function endLabelPlan<T, X extends ChartX>(
  plot: PlotContext<T, X>,
  lines: readonly ChartSeries<T>[],
  getX: (d: T) => X,
  xDomain: readonly [X, X] | undefined,
): EndLabel<T, X>[] {
  if (plot.containerClass !== 'wide' || plot.y2 !== undefined) return []
  if (lines.length === 0 || lines.length > MAX_END_LABELS) return []
  const last = lines.flatMap((series) => {
    const row = plot.rows(series.key).findLast((r) => r.y !== null)
    return row ? [{ series, row }] : []
  })
  // Collision check in pixels from the plot height: labels that would overlap are not drawn at all.
  // No `y2` here (returned above), so every label reads the left domain.
  const domain = plot.yDomain
  const ys = last.map(({ row }) =>
    row.y === null
      ? Number.NaN
      : ((row.y - domain[0]) / (domain[1] - domain[0] || 1)) * plot.height,
  )
  const sorted = ys.toSorted((a, b) => a - b)
  const collides = sorted.some(
    (y, i) => Number.isNaN(y) || (i > 0 && y - (sorted[i - 1] as number) < END_LABEL_MIN_GAP),
  )
  if (collides) return []
  return last.map(({ series, row }) => ({
    series,
    row,
    anchor: endLabelAnchor({
      fraction: xFractionIn(plot.data, getX, xDomain, row.x),
      plotWidth: plot.plotWidth,
      label: series.label,
      fontSize: VX.text.micro,
    }),
  }))
}

export function endLabelMarks<T, X extends ChartX>(plan: readonly EndLabel<T, X>[]): ChartMarks {
  return plan.map(({ series, row, anchor }) => {
    const flipped = anchor === 'end'
    return decorative(
      text([row], {
        id: `${series.key}-end-label`,
        x: rowX,
        y: 'y',
        text: () => series.label,
        fill: series.color,
        fontSize: VX.text.micro,
        anchor,
        dx: flipped ? -END_LABEL_DX : END_LABEL_DX,
        dy: flipped ? END_LABEL_FLIP_DY : 0,
      }),
    )
  })
}
