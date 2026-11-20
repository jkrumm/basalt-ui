/**
 * The engine's text measure, from basalt's generated label widths (`chart-labels-widths.gen.ts`), so
 * axis gutters, tick thinning and label room come out the same on the server and in the browser: the
 * server picture is the hydrated one, and a late webfont never moves the plot. Like
 * `chartLabels.width` it is the default chart sans; a face retuned through `--basalt-chart-font`
 * is measured as that sans.
 */
import type { ChartTextMeasurer, ChartTextMetrics } from '@tanstack/charts/types/core'
import { measure } from './label-widths'
import type { TableWeight } from './label-widths'

const WEIGHTS: readonly TableWeight[] = [400, 500, 600, 700]

/** Ink above the alphabetic baseline (cap and figure height with overshoot) and below it, in em. */
const ASCENT = 0.72
const DESCENT = 0.21
/**
 * Room per glyph, in em, over the table's advance, for centred text: Chrome without subpixel
 * positioning (Linux CI) draws an 11 px axis label wider than the Mac-measured table, 19 glyphs by
 * about 4 px (the band axis layout test, 2026-11-20), and a centred x label is the one the engine
 * clamps to the svg's edges, where that excess spills. Start- and end-anchored text (y ticks, the y
 * title) keeps the table's width: a fixed `y.gutter` places the title by it.
 */
const GLYPH_ROOM = 0.03

/** Glyphs whose ink reaches below the baseline. */
const DESCENDERS = /[gjpqyQ,;()[\]{}|/@_$µ]/u

const NONE: ChartTextMetrics = { x: 0, y: 0, width: 0, height: 0 }

const nearestWeight = (weight = 400): TableWeight =>
  WEIGHTS.reduce((best, w) => (Math.abs(w - weight) < Math.abs(best - weight) ? w : best))

export const measureChartText: ChartTextMeasurer = (text, options) => {
  const scale = options.fontScale > 0 ? options.fontScale : 1
  const size = options.fontSize * scale
  if (!text || !(size > 0)) return NONE
  const room = options.anchor === 'middle' ? GLYPH_ROOM * size : 0
  const spacing = (options.letterSpacing || 0) * scale + room
  const width =
    measure(text, size, nearestWeight(options.fontWeight)) +
    Math.max(0, [...text].length - 1) * spacing
  const ascent = ASCENT * size
  const height = ascent + (DESCENDERS.test(text) ? DESCENT * size : 0)
  const startsAtLeft = options.direction !== 'rtl'
  const x =
    options.anchor === 'middle'
      ? -width / 2
      : (options.anchor === 'start') === startsAtLeft
        ? 0
        : -width
  const y =
    options.baseline === 'middle' ? -height / 2 : options.baseline === 'hanging' ? 0 : -ascent
  return { x, y, width, height }
}
