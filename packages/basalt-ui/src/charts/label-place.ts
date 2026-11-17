/**
 * The direct-label collision pass, over a width function the caller brings. `chartLabels` runs it
 * with the measured glyph table (`chart-labels-widths.gen.ts`); the kinds' own value labels run it
 * with a per-glyph estimate, so a chart that labels its bars does not carry the 8 KB table.
 */
import type { ChartLabel, LabelBox, LabelSpot, LabelWeight, PlacedLabel } from './chart-labels'
import { hostObstacles } from './label-obstacles'

/** A text's width in px at a size and weight. */
export type MeasureText = (text: string, size: number, weight: LabelWeight) => number

const SPOTS: readonly LabelSpot[] = [
  'right',
  'left',
  'above',
  'below',
  'above-right',
  'above-left',
  'below-right',
  'below-left',
]

/** A label box is this many times its font size tall. */
const LINE_HEIGHT_RATIO = 1.2

/** The alphabetic baseline sits this share of the font size below the box's vertical centre. */
const BASELINE_OFFSET = 0.35

/** Default distance in px between the anchor and the label box. */
const DEFAULT_GAP = 4

export const lineHeight = (size: number): number => size * LINE_HEIGHT_RATIO

function boxFor(
  spot: LabelSpot,
  x: number,
  y: number,
  width: number,
  height: number,
  gap: number,
): Pick<PlacedLabel, 'left' | 'top' | 'textAnchor'> {
  const centredTop = y - height / 2
  const centredLeft = x - width / 2
  switch (spot) {
    case 'right':
      return { left: x + gap, top: centredTop, textAnchor: 'start' }
    case 'left':
      return { left: x - gap - width, top: centredTop, textAnchor: 'end' }
    case 'above':
      return { left: centredLeft, top: y - gap - height, textAnchor: 'middle' }
    case 'below':
      return { left: centredLeft, top: y + gap, textAnchor: 'middle' }
    case 'above-right':
      return { left: x + gap, top: y - gap - height, textAnchor: 'start' }
    case 'above-left':
      return { left: x - gap - width, top: y - gap - height, textAnchor: 'end' }
    case 'below-right':
      return { left: x + gap, top: y + gap, textAnchor: 'start' }
    case 'below-left':
      return { left: x - gap - width, top: y + gap, textAnchor: 'end' }
  }
}

const overlaps = (a: LabelBox, b: LabelBox): boolean =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height

const inside = (box: LabelBox, frame: { width: number; height: number }): boolean =>
  box.left >= 0 &&
  box.top >= 0 &&
  box.left + box.width <= frame.width &&
  box.top + box.height <= frame.height

/** Whether `text` fits `box` on one line, with `pad` px kept free on every side. */
export function fitsWith(
  measure: MeasureText,
  text: string,
  box: { width: number; height?: number },
  options: { size: number; weight?: LabelWeight; pad?: number },
): boolean {
  const pad = options.pad ?? 0
  if (measure(text, options.size, options.weight ?? 400) > box.width - 2 * pad) return false
  return box.height === undefined || lineHeight(options.size) <= box.height - 2 * pad
}

/**
 * Place each label on the first free spot, highest `priority` first (ties keep input order). A
 * spot is free when its box lies fully inside `frame` and overlaps no placed label, no obstacle and
 * nothing the host published (`hostObstacles`); a label with no free spot is returned in `dropped`.
 */
export function placeWith<K extends string>(
  measure: MeasureText,
  labels: readonly ChartLabel<K>[],
  frame: { width: number; height: number },
  options: { gap?: number; obstacles?: readonly LabelBox[]; size: number },
): { placed: PlacedLabel<K>[]; dropped: ChartLabel<K>[] } {
  const gap = options.gap ?? DEFAULT_GAP
  const taken: LabelBox[] = [...(options.obstacles ?? []), ...hostObstacles()]
  const placed: PlacedLabel<K>[] = []
  const dropped: ChartLabel<K>[] = []
  const ranked = labels
    .map((label, index) => ({ label, index }))
    .toSorted((a, b) => (b.label.priority ?? 0) - (a.label.priority ?? 0) || a.index - b.index)

  for (const { label } of ranked) {
    const size = label.size ?? options.size
    const width = measure(label.text, size, label.weight ?? 400)
    const height = lineHeight(size)
    let landed: PlacedLabel<K> | undefined
    for (const spot of label.spots ?? SPOTS) {
      const at = boxFor(spot, label.x, label.y, width, height, gap)
      const box = { left: at.left, top: at.top, width, height }
      if (!inside(box, frame) || taken.some((other) => overlaps(box, other))) continue
      const textX =
        at.textAnchor === 'start'
          ? box.left
          : at.textAnchor === 'end'
            ? box.left + width
            : box.left + width / 2
      landed = {
        ...label,
        spot,
        ...box,
        textAnchor: at.textAnchor,
        baselineY: box.top + height / 2 + size * BASELINE_OFFSET,
        textX,
        dx: textX - label.x,
        dy: box.top + height / 2 - label.y,
      }
      break
    }
    if (landed === undefined) {
      dropped.push(label)
      continue
    }
    taken.push(landed)
    placed.push(landed)
  }
  return { placed, dropped }
}
