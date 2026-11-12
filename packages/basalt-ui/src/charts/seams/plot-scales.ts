import { planar } from './define'

/** The slice of the engine's `PlotContext` the pixel seams read: the laid-out plot and the left y domain. */
export type PlotGeometry = {
  plotWidth: number
  plotHeight: number
  yDomain: readonly [number, number]
}

/** An x domain as the chart is given it (`x.domain`), or the extent of the data. */
export type XExtent = readonly [number | Date, number | Date]

/** Value to pixels and back, measured from the plot's top-left corner (y grows downward, as on screen). */
export type PlotScales = {
  /** The x pixel of a value; a `Date` or a number. */
  x: (value: number | Date) => number
  /** The y pixel of a value, `0` at the top of the plot. */
  y: (value: number) => number
  /** The x value `px` pixels from the left; a `Date` when the domain is one. */
  xAt: (px: number) => number | Date
  /** The y value `px` pixels below the top of the plot. */
  yAt: (px: number) => number
}

const at = (v: number | Date): number => +v

/**
 * `plot.scales`: the pixel maps a `marks` builder needs when it places something the engine does not
 * (labels against each other, a rail of a fixed height). One plot pixel is `(yMax - yMin) / plotHeight`
 * y units; a domain that is flat maps everything to the near edge instead of dividing by zero.
 */
export function plotScales(plot: PlotGeometry, xDomain: XExtent): PlotScales {
  const width = Math.max(1, plot.plotWidth)
  const height = Math.max(1, plot.plotHeight)
  const yMin = Math.min(...plot.yDomain)
  const yMax = Math.max(...plot.yDomain)
  const x0 = at(xDomain[0])
  const xSpan = at(xDomain[1]) - x0
  const ySpan = yMax - yMin
  const isDate = xDomain[0] instanceof Date
  return {
    x: (value) => (xSpan === 0 ? 0 : ((at(value) - x0) / xSpan) * width),
    y: (value) => (ySpan === 0 ? 0 : ((yMax - value) / ySpan) * height),
    xAt: (px) => {
      const value = x0 + (px / width) * xSpan
      return isDate ? new Date(value) : value
    },
    yAt: (px) => yMax - (px / height) * ySpan,
  }
}

export const plotScalesSeam = planar({
  id: 'plot.scales',
  consumer:
    'argo features/models/efficiency-scatter.tsx:329 and scatter-labels.ts:41-51, labels are placed in plot pixels against the x and y domains',
})
