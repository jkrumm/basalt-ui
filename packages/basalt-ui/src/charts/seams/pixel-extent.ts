import { planar } from './define'
import type { PlotGeometry } from './plot-scales'

export type PixelExtent = {
  /** Which plot edge the rule hugs. */
  edge: 'top' | 'bottom'
  /** The rule's thickness in plot pixels. */
  px: number
  /** Pixels between the edge and the rule. Default `0`. */
  inset?: number
}

/**
 * The pixel-extent rule: the `[y1, y2]` of a rule mark (or a rect) that is `px` plot pixels tall
 * along the top or bottom edge, whatever the y domain. `y1` is the lower value.
 *
 * ```ts
 * rect(rows, { x1, x2, ...pixelExtent(plot, { edge: 'bottom', px: 3 }) })
 * ```
 */
export function pixelExtent(
  plot: PlotGeometry,
  { edge, px, inset = 0 }: PixelExtent,
): { y1: number; y2: number } {
  const yMin = Math.min(...plot.yDomain)
  const yMax = Math.max(...plot.yDomain)
  const perPx = (yMax - yMin) / Math.max(1, plot.plotHeight)
  if (edge === 'bottom') {
    const y1 = yMin + inset * perPx
    return { y1, y2: y1 + px * perPx }
  }
  const y2 = yMax - inset * perPx
  return { y1: y2 - px * perPx, y2 }
}

export const pixelExtentRule = planar({
  id: 'pixel-extent rule',
  consumer:
    'linewatch web/src/charts/latency-band-chart.tsx:407-409, the outage and vantage rails draw the declared 3 and 5 px at `plot.plotHeight`',
})
