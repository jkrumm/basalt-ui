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

/**
 * A box another label has claimed in the same plot: a share of the plot width and a span of values
 * on the left axis. A caption never takes a spot that overlaps one.
 */
export type LabelBox = { fx0: number; fx1: number; y0: number; y1: number }

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
export function yRangeWithin(
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
  /** Labels already placed on this axis (end labels): a caption keeps clear of them too. */
  claimed?: readonly LabelBox[] | undefined
}): RefLabelPosition {
  const { pinned, startFirst, value, plotWidth, plotHeight, label, fontSize, series } = opts
  const { claimed = [] } = opts
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
    return (
      series.every((points) => {
        const range = yRangeWithin(points, fx0, fx1)
        return range === null || range[1] < from || range[0] > to
      }) && claimed.every((b) => b.fx1 < fx0 || b.fx0 > fx1 || b.y1 < from || b.y0 > to)
    )
  }
  // A caption that cannot avoid the data still stays inside the plot.
  return (
    order.find((p) => inPlot(p) && clear(p)) ?? order.find(inPlot) ?? (order[0] as RefLabelPosition)
  )
}

/** The gap between a sparkline reference label's box and its line, px. */
const SPARK_LABEL_GAP = 2
/** Air between a sparkline label's box and the data line (stroke and end dot included), px. */
const SPARK_LINE_AIR = 5

export type SparkLabelPlacement = {
  side: 'above' | 'below'
  end: 'start' | 'end'
  /** The engine centres the text on its y: the offset that puts the box on `side` of the line. */
  dy: number
}

/**
 * Where a sparkline's reference label sits: of start-above, start-below, end-above, end-below, the
 * one whose box stays inside the plot (`height` in full) and moves least off the reference to clear
 * the data line by {@link SPARK_LINE_AIR} (the first of the four on a tie). The box clears the
 * reference by at least {@link SPARK_LABEL_GAP}, so the dashed rule never strikes the text.
 * `line` is the plotted polyline as `{ fx, y }` (a share of the plot width, a value on `domain`);
 * without it (a bar sparkline, or no `width`/`label`) only the plot bounds decide.
 */
export function referenceLabelPlacement(opts: {
  value: number
  domain: readonly [number, number]
  height: number
  /** Plot width, px. */
  width?: number | undefined
  /** The plot's margin inside the svg box, px. */
  inset: number
  fontSize: number
  label?: string | undefined
  line?: readonly RefLabelPoint[] | undefined
}): SparkLabelPlacement {
  const { value, domain, height, inset, fontSize, line } = opts
  const { width = 0, label = '' } = opts
  const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
  const plotH = height - 2 * inset
  const plotW = width - 2 * inset
  const px = (y: number): number => inset + plotH * (1 - (hi === lo ? 0 : (y - lo) / (hi - lo)))
  const at = px(value)
  const boxH = fontSize
  const boxW = label.length * fontSize * GLYPH_EM + EDGE_INSET
  const pxLine = line?.map((p) => ({ fx: p.fx, y: px(p.y) }))
  const candidates = (['start', 'end'] as const).flatMap((end) =>
    (['above', 'below'] as const).map((side) => {
      const nominal = side === 'above' ? at - SPARK_LABEL_GAP - boxH : at + SPARK_LABEL_GAP
      const [fx0, fx1] = end === 'start' ? [0, boxW / plotW] : [1 - boxW / plotW, 1]
      // The curve between two points stays between their values but not on the chord, so the
      // window reaches out to the vertices that bound it.
      const lead = pxLine?.find((p) => p.fx >= fx1)?.fx ?? fx1
      const trail = pxLine?.findLast((p) => p.fx <= fx0)?.fx ?? fx0
      const range =
        pxLine === undefined || plotW <= 0
          ? null
          : yRangeWithin(pxLine, Math.min(trail, fx0), Math.max(lead, fx1))
      // A box the line comes within the air of slides away from the reference, along its side, until it has air.
      const near =
        range !== null &&
        range[1] + SPARK_LINE_AIR > nominal &&
        range[0] - SPARK_LINE_AIR < nominal + boxH
      const top = !near
        ? nominal
        : side === 'above'
          ? range[0] - SPARK_LINE_AIR - boxH
          : range[1] + SPARK_LINE_AIR
      return {
        side,
        end,
        top,
        shift: Math.abs(top - nominal),
        fits: top >= 0 && top + boxH <= height,
      }
    }),
  )
  const fitting = candidates.filter((c) => c.fits)
  // The fitting spot that stays nearest the reference (the first of the four on a tie), else the
  // first: the plot bounds alone decide when nothing fits.
  const found = fitting.reduce<(typeof candidates)[number] | undefined>(
    (best, c) => (best === undefined || c.shift < best.shift ? c : best),
    undefined,
  )
  const { side, end, top } = found ?? (candidates[0] as (typeof candidates)[number])
  const dy = top + boxH / 2 - at
  return { side, end, dy }
}
