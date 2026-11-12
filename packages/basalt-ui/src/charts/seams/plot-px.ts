import { planar } from './define'
import { plotScales } from './plot-scales'
import type { PlotGeometry, XExtent } from './plot-scales'

/**
 * `plot.pxToY`: the y value `px` pixels below the top of the plot, on the plot area (`plotHeight`),
 * never the frame (`height`). A first pass reports the frame, so the value is right once the engine
 * has measured; marks drawn from it re-render once.
 */
export function pxToY(plot: PlotGeometry, px: number): number {
  return plotScales(plot, [0, 1]).yAt(px)
}

/** `plot.pxToX`: the x value `px` pixels from the left of the plot, on the given x domain. */
export function pxToX(plot: PlotGeometry, xDomain: XExtent, px: number): number | Date {
  return plotScales(plot, xDomain).xAt(px)
}

export const plotPx = planar({
  id: 'plot.pxToY and pxToX',
  consumer:
    'linewatch web/src/charts/latency-band-chart.tsx:407-426, `perPx = (yMax - yMin) / plot.plotHeight` draws the outage and vantage rails 3 and 5 px tall',
})
