/**
 * The surface a struck value label is drawn on. A text mark has no stroke, so a rule that
 * crosses a label's glyphs is covered by a card-colored box under them: the rule gives way to the number.
 */
import { decorative } from '@tanstack/charts/mark/decorative'
import { rect } from '@tanstack/charts/rect'
import type { LabelBox } from '../chart-labels'
import type { ChartMarks } from '../types'
import { CV } from './theme'

/** The thickest a rule's box is, px: a hairline and the air a label keeps. A bar, a dot or a label is thicker or shorter than the plot. */
const RULE_MAX_PX = 6

/**
 * Whether `box` lies over a rule among `obstacles`: a box no thicker than a hairline that spans the plot's
 * whole width (a value's rule) or height (an x rule). A bar, a dot, a label or a line piece is none of them.
 */
export function isStruck(
  box: LabelBox,
  obstacles: readonly LabelBox[],
  frame: { width: number; height: number },
): boolean {
  return obstacles.some(
    (o) =>
      ((o.height <= RULE_MAX_PX && o.width >= frame.width - 1) ||
        (o.width <= RULE_MAX_PX && o.height >= frame.height - 1)) &&
      o.left < box.left + box.width &&
      box.left < o.left + o.width &&
      o.top < box.top + box.height &&
      box.top < o.top + o.height,
  )
}

/**
 * One card-colored rect per struck box. `frame` is the plot in px and `domain` the y values its height spans
 * (low, high) on `scale`; the boxes are in plot px, the rect in plot fractions and values.
 */
export function backingMarks(opts: {
  id: string
  boxes: readonly LabelBox[]
  frame: { width: number; height: number }
  domain: readonly [number, number]
  scale: 'y' | 'y2'
  /** The rect's paint: the card's own color by default, a leader's ink when the boxes are hairlines. */
  fill?: string
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
        fill: opts.fill ?? CV.surface,
        inset: 0,
        id: opts.id,
      }),
    ),
  ] as unknown as ChartMarks
}
