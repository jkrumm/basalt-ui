/**
 * The surface a struck value label is drawn on. A text mark has no stroke, so a rule or a line piece that
 * crosses a label's glyphs is covered by a card-coloured box under them: the rule gives way to the number.
 */
import { decorative } from '@tanstack/charts/mark/decorative'
import { rect } from '@tanstack/charts/rect'
import type { LabelBox } from '../chart-labels'
import type { ChartMarks } from '../types'
import { CV } from './theme'

/** The least side of a text-sized box, px: a rule is 4 px thick and a line path piece under 11, a caption is 13 and more. */
const TEXT_BOX_MIN_PX = 12

/** Whether `box` lies over a rule or a line piece among `obstacles` (a box thinner than a caption). */
export function isStruck(box: LabelBox, obstacles: readonly LabelBox[]): boolean {
  return obstacles.some(
    (o) =>
      Math.min(o.width, o.height) < TEXT_BOX_MIN_PX &&
      o.left < box.left + box.width &&
      box.left < o.left + o.width &&
      o.top < box.top + box.height &&
      box.top < o.top + o.height,
  )
}

/**
 * One card-coloured rect per struck box. `frame` is the plot in px and `domain` the y values its height spans
 * (low, high) on `scale`; the boxes are in plot px, the rect in plot fractions and values.
 */
export function backingMarks(opts: {
  id: string
  boxes: readonly LabelBox[]
  frame: { width: number; height: number }
  domain: readonly [number, number]
  scale: 'y' | 'y2'
}): ChartMarks {
  const { boxes, frame, domain, scale } = opts
  if (boxes.length === 0 || frame.width <= 0 || frame.height <= 0) return []
  const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
  const valueAt = (py: number): number => hi - (py / frame.height) * (hi - lo)
  const rects = boxes.map((b) => ({
    fx0: b.left / frame.width,
    fx1: (b.left + b.width) / frame.width,
    y0: valueAt(b.top + b.height),
    y1: valueAt(b.top),
  }))
  return [
    decorative(
      rect(rects, {
        x1: 'fx0',
        x2: 'fx1',
        y1: 'y0',
        y2: 'y1',
        xScale: 'zx',
        yScale: scale,
        fill: CV.surface,
        inset: 0,
        id: opts.id,
      }),
    ),
  ] as unknown as ChartMarks
}
