/**
 * What a page's own `chartLabels.place` asks the host to draw under its text: a hairline from a label
 * set farther off than the spots beside its anchor back to the anchor, and a surface plate under a label
 * that had to lie over dots, so its text reads. Drawn between the series' marks and the page's own,
 * so a plate covers the dots and the text covers the plate.
 */
import { decorative } from '@tanstack/charts/mark/decorative'
import { lineY } from '@tanstack/charts/line'
import { rect } from '@tanstack/charts/rect'
import type { LabelTies } from '../label-obstacles'
import type { ChartMarks } from '../types'
import { CV } from './theme'

/** A hairline's stroke, px. */
const LEADER_WIDTH = 1
/** Air a plate keeps round its label's box, px. */
const PLATE_AIR = 1.5

/**
 * `ties` are in the plot's px from its top left; the marks sit on the hidden `[0, 1]` x scale the
 * zones use and on the left value axis (`domain`, `yScale`). Nothing before the plot is measured.
 */
export function labelTieMarks(opts: {
  ties: LabelTies
  plot: { width: number; height: number }
  domain: readonly [number, number]
  yScale: string
}): ChartMarks {
  const { ties, plot, domain, yScale } = opts
  if (plot.width <= 0 || plot.height <= 0) return []
  const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
  const fx = (x: number): number => x / plot.width
  const value = (y: number): number => hi - (y / plot.height) * (hi - lo)
  const plates = ties.plates.map((box, i) =>
    decorative(
      rect(
        [
          {
            fx0: fx(box.left - PLATE_AIR),
            fx1: fx(box.left + box.width + PLATE_AIR),
            y0: value(box.top + box.height + PLATE_AIR),
            y1: value(box.top - PLATE_AIR),
          },
        ],
        {
          x1: 'fx0',
          x2: 'fx1',
          y1: 'y0',
          y2: 'y1',
          xScale: 'zx',
          yScale,
          fill: CV.surface,
          inset: 0,
          id: `label-plate-${i}`,
        },
      ),
    ),
  )
  const leaders = ties.leaders.map((leader, i) =>
    decorative(
      lineY(
        [
          { f: fx(leader.from.x), v: value(leader.from.y) },
          { f: fx(leader.to.x), v: value(leader.to.y) },
        ],
        {
          id: `label-leader-${i}`,
          x: (d: { f: number }) => d.f,
          y: (d: { v: number }) => d.v,
          xScale: 'zx',
          yScale,
          stroke: CV.axis,
          strokeWidth: LEADER_WIDTH,
          strokeOpacity: 0.7,
        },
      ),
    ),
  )
  return [...plates, ...leaders]
}
