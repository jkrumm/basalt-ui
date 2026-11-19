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

/**
 * A glyph's advance as a share of the font size: the chart face's tabular figures are 0.6 em, so a
 * value label errs a hair wide. An estimate, not the measured table, which would put 8 KB into
 * every chart that labels its bars.
 */
const VALUE_GLYPH_EM = 0.62

/** A text's width in px by the per-glyph estimate, for the labels a kind draws itself. */
export const estimateWidth = (text: string, size: number): number =>
  [...text].length * size * VALUE_GLYPH_EM

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

/**
 * A box held inside the frame along the edge it overflows, when sliding it keeps its anchor beside
 * it: a centred spot (above, below) slides sideways, a side spot (right, left) up or down by at
 * most half its height, so a label on a point at the plot's edge still lands on it.
 */
function slid(spot: LabelSpot, box: LabelBox, frame: { width: number; height: number }): LabelBox {
  const centred = spot === 'above' || spot === 'below'
  const beside = spot === 'right' || spot === 'left'
  const left = centred ? Math.min(Math.max(box.left, 0), frame.width - box.width) : box.left
  const top = beside ? Math.min(Math.max(box.top, 0), frame.height - box.height) : box.top
  const reach = box.height / 2
  return Math.abs(top - box.top) <= reach ? { ...box, left, top } : { ...box, left }
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
 * nothing the host published (`hostObstacles`).
 *
 * A dense cloud leaves no free spot: every one of the eight meets a dot. With `pointMarks` (a page's
 * own `chartLabels.place`), an obstacle the page passes
 * that is no taller or wider than a label line is a point mark (a dot, a tick), and a label with no
 * free spot lands on the spot that meets the fewest of them, beside its anchor, as long as it clears
 * everything else (placed labels, bars, captions, the host's boxes). Only a label whose every spot
 * meets something larger is returned in `dropped`.
 */
export function placeWith<K extends string>(
  measure: MeasureText,
  labels: readonly ChartLabel<K>[],
  frame: { width: number; height: number },
  options: { gap?: number; obstacles?: readonly LabelBox[]; size: number; pointMarks?: boolean },
): { placed: PlacedLabel<K>[]; dropped: ChartLabel<K>[] } {
  const gap = options.gap ?? DEFAULT_GAP
  const reach = lineHeight(options.size)
  // Only a page's own call (`chartLabels.place`) says its small obstacles are point marks: the kinds
  // pass placed labels as obstacles, and those stay hard.
  const isPoint = (box: LabelBox): boolean =>
    options.pointMarks === true && box.width <= reach && box.height <= reach
  // Hard boxes stop a label for good; point marks only count against a spot.
  const points: LabelBox[] = (options.obstacles ?? []).filter(isPoint)
  const taken: LabelBox[] = [
    ...(options.obstacles ?? []).filter((b) => !isPoint(b)),
    ...hostObstacles(),
  ]
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
    // The spot that clears everything hard and meets the fewest point marks, for a crowded anchor.
    let crowded: { spot: LabelSpot; box: LabelBox; met: number } | undefined
    const land = (spot: LabelSpot, box: LabelBox): PlacedLabel<K> => {
      const at = boxFor(spot, label.x, label.y, width, height, gap)
      const textX =
        at.textAnchor === 'start'
          ? box.left
          : at.textAnchor === 'end'
            ? box.left + width
            : box.left + width / 2
      return {
        ...label,
        size,
        spot,
        ...box,
        textAnchor: at.textAnchor,
        baselineY: box.top + height / 2 + size * BASELINE_OFFSET,
        textX,
        dx: textX - label.x,
        dy: box.top + height / 2 - label.y,
      }
    }
    for (const spot of label.spots ?? SPOTS) {
      const at = boxFor(spot, label.x, label.y, width, height, gap)
      const box = slid(spot, { left: at.left, top: at.top, width, height }, frame)
      if (!inside(box, frame) || taken.some((other) => overlaps(box, other))) continue
      const met = points.filter((other) => overlaps(box, other)).length
      if (met === 0) {
        landed = land(spot, box)
        break
      }
      if (crowded === undefined || met < crowded.met) crowded = { spot, box, met }
    }
    if (landed === undefined && crowded !== undefined) landed = land(crowded.spot, crowded.box)
    if (landed === undefined) {
      dropped.push(label)
      continue
    }
    taken.push(landed)
    placed.push(landed)
  }
  return { placed, dropped }
}
