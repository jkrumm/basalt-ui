/**
 * Where a reference line's caption sits. Pure, so the rule is tested without an engine: a
 * caption takes the first of four spots (end/start of the plot, above/below its line) that stays
 * inside the plot and that no data line runs through; `RefLine.labelPosition` pins one.
 */

export type RefLabelPosition = 'end-above' | 'end-below' | 'start-above' | 'start-below'

/** A data point as a share of the plot width and a y value on the line's own axis. */
export type RefLabelPoint = { fx: number; y: number }

/** A glyph's advance as a share of the font size (proportional Latin text, capitals included). */
const GLYPH_EM = 0.62
/** The inset from the plot edge (the text's `dx`) and the gap between caption and line, in px. */
const EDGE_INSET = 6
const LINE_GAP = 3

const ORDER_END: readonly RefLabelPosition[] = [
  'end-above',
  'end-below',
  'start-above',
  'start-below',
]
const ORDER_START: readonly RefLabelPosition[] = [
  'start-above',
  'start-below',
  'end-above',
  'end-below',
]

/** The y range of the polyline `points` (sorted by `fx`) between `fx0` and `fx1`, or `null`. */
function yRangeWithin(
  points: readonly RefLabelPoint[],
  fx0: number,
  fx1: number,
): [number, number] | null {
  let lo = Infinity
  let hi = -Infinity
  const take = (y: number): void => {
    if (y < lo) lo = y
    if (y > hi) hi = y
  }
  const at = (a: RefLabelPoint, b: RefLabelPoint, fx: number): number =>
    b.fx === a.fx ? a.y : a.y + ((b.y - a.y) * (fx - a.fx)) / (b.fx - a.fx)
  for (let i = 0; i < points.length; i++) {
    const p = points[i] as RefLabelPoint
    if (p.fx >= fx0 && p.fx <= fx1) take(p.y)
    const next = points[i + 1]
    if (next === undefined || (p.fx < fx0 && next.fx < fx0) || (p.fx > fx1 && next.fx > fx1))
      continue
    // A segment entering or leaving the window contributes where it crosses its edge.
    for (const edge of [fx0, fx1]) {
      if ((p.fx < edge && next.fx > edge) || (p.fx > edge && next.fx < edge))
        take(at(p.fx < next.fx ? p : next, p.fx < next.fx ? next : p, edge))
    }
  }
  return lo <= hi ? [lo, hi] : null
}

export function refLabelPosition(opts: {
  /** `RefLine.labelPosition`: wins over everything. */
  pinned: RefLabelPosition | undefined
  /** The default end when nothing constrains it: `true` for a right-axis line. */
  startFirst: boolean
  value: number
  domain: readonly [number, number]
  plotWidth: number
  plotHeight: number
  label: string
  fontSize: number
  /** One polyline per visible series on the line's axis. */
  series: readonly (readonly RefLabelPoint[])[]
}): RefLabelPosition {
  const { pinned, startFirst, value, plotWidth, plotHeight, label, fontSize, series } = opts
  const order = startFirst ? ORDER_START : ORDER_END
  if (pinned !== undefined) return pinned
  const [lo, hi] = [Math.min(...opts.domain), Math.max(...opts.domain)]
  if (hi === lo || plotWidth <= 0 || plotHeight <= 0) return order[0] as RefLabelPosition
  const perPx = (hi - lo) / plotHeight
  const widthFx = (label.length * fontSize * GLYPH_EM + EDGE_INSET) / plotWidth
  const heightPx = fontSize + 2
  const bandOf = (position: RefLabelPosition): [number, number] =>
    position.endsWith('above')
      ? [value + LINE_GAP * perPx, value + (LINE_GAP + heightPx) * perPx]
      : [value - (LINE_GAP + heightPx) * perPx, value - LINE_GAP * perPx]
  const inPlot = (position: RefLabelPosition): boolean => {
    const [from, to] = bandOf(position)
    return from >= lo && to <= hi
  }
  const clear = (position: RefLabelPosition): boolean => {
    const [from, to] = bandOf(position)
    const [fx0, fx1] = position.startsWith('end')
      ? [1 - widthFx, 1 - EDGE_INSET / plotWidth]
      : [EDGE_INSET / plotWidth, widthFx]
    return series.every((points) => {
      const range = yRangeWithin(points, fx0, fx1)
      return range === null || range[1] < from || range[0] > to
    })
  }
  // A caption that cannot avoid the data still stays inside the plot.
  return (
    order.find((p) => inPlot(p) && clear(p)) ?? order.find(inPlot) ?? (order[0] as RefLabelPosition)
  )
}

/** The gap between a sparkline reference label's box and its line, px. */
const SPARK_LABEL_GAP = 2

/**
 * Which side of its line a sparkline's reference label sits on, and its `dy` (the engine centres
 * the text on its y): above by default, below when the line is too near the plot top for the label
 * box to fit above it. The box clears the line by {@link SPARK_LABEL_GAP}, so the dashed rule never
 * strikes the text, and stays inside the plot (`height` less the line inset each side).
 */
export function referenceLabelPlacement(opts: {
  value: number
  domain: readonly [number, number]
  height: number
  /** The plot's margin inside the svg box, px. */
  inset: number
  fontSize: number
}): { side: 'above' | 'below'; dy: number } {
  const { value, domain, height, inset, fontSize } = opts
  const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
  const share = hi === lo ? 0 : (value - lo) / (hi - lo)
  const line = inset + (height - 2 * inset) * (1 - share)
  const reach = SPARK_LABEL_GAP + fontSize + 1
  const side = line - reach >= 0 || line + reach > height ? 'above' : 'below'
  const dy = (SPARK_LABEL_GAP + (fontSize + 1) / 2) * (side === 'above' ? -1 : 1)
  return { side, dy }
}
