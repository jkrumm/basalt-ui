import type { ContainerClass } from '../../tokens/size-classes'
import type { ChartSeries } from '../series'
import { measureText } from '../utils/measure-text'

/** Space between the plot edge and an end label's first glyph. */
export const END_LABEL_GAP = 6

/** End labels are for a handful of lines; past this the legend alone names them. */
export const MAX_END_LABELS = 3

/** Line box of one end label, as a multiple of its font size — the collision gap. */
export const END_LABEL_LINE_HEIGHT = 1.3

/** The gutter may take at most this share of the plot width; past it the labels are not drawn. */
const MAX_GUTTER_SHARE = 0.25

/**
 * Greedy collision nudging for direct labels. Each `ys` entry is a label's preferred CENTRE; the
 * result keeps input order and holds every label at least `minGap` from its neighbours, inside
 * `[min, max]`. Sorted by y, each label yields to the one above it, then a backward pass pulls the
 * stack up off the bottom edge. Returns `null` when the labels cannot all fit — the caller draws
 * none (the legend still names every series) rather than a partial or overlapping set.
 */
export function nudgeLabels(input: {
  ys: readonly number[]
  minGap: number
  min: number
  max: number
}): number[] | null {
  const { ys, minGap, min, max } = input
  if (ys.length === 0) return []
  if (ys.some((y) => !Number.isFinite(y))) return null
  if ((ys.length - 1) * minGap > max - min) return null

  const order = ys.map((y, i) => ({ y, i })).toSorted((a, b) => a.y - b.y)

  let prev = Number.NEGATIVE_INFINITY
  const forward = order.map(({ y, i }) => {
    prev = Math.max(y, min, prev + minGap)
    return { i, y: prev }
  })

  let next = Number.POSITIVE_INFINITY
  const back = forward.toReversed().map(({ i, y }) => {
    next = Math.min(y, max, next - minGap)
    return { i, y: next }
  })
  if (next < min) return null

  return back.toSorted((a, b) => a.i - b.i).map((p) => p.y)
}

/**
 * The right gutter the end labels need: the widest label plus the gap. `null` when it would eat
 * more than a quarter of the plot — a label longer than that has no honest place in a gutter.
 */
export function endLabelGutter(input: {
  labels: readonly string[]
  fontPx: number
  plotWidth: number
}): number | null {
  const { labels, fontPx, plotWidth } = input
  if (labels.length === 0) return null
  const widest = labels.reduce((max, label) => Math.max(max, measureText(label, fontPx)), 0)
  const gutter = Math.ceil(widest) + END_LABEL_GAP
  return gutter > plotWidth * MAX_GUTTER_SHARE ? null : gutter
}

/** One drawn end label: the series it names and its nudged centre y. */
export type EndLabel<T> = { series: ChartSeries<T>; y: number }

/**
 * Whether and how a chart draws end-of-line labels. Eligible only on a wide container with one y
 * axis, no consumer `margin.right`, and 1..{@link MAX_END_LABELS} visible series that are all lines.
 * Each label sits at its line's last non-null value, nudged apart; the plan is `null` — no gutter
 * reserved, nothing drawn — when any rule fails, a series has no plottable value, the stack cannot
 * fit, or the gutter would be too wide. The gutter is measured from the label text.
 */
export function planEndLabels<T>(input: {
  containerClass: ContainerClass
  hasY2: boolean
  hasMarginRight: boolean
  visible: readonly ChartSeries<T>[]
  data: readonly T[]
  yScale: (value: number) => number
  yMax: number
  fontPx: number
  /** Plot width before any gutter is taken. */
  plotWidth: number
}): { gutter: number; labels: EndLabel<T>[] } | null {
  const { containerClass, hasY2, hasMarginRight, visible, data, yScale, yMax, fontPx, plotWidth } =
    input
  if (containerClass !== 'wide' || hasY2 || hasMarginRight) return null
  if (visible.length < 1 || visible.length > MAX_END_LABELS) return null
  if (!visible.every((s) => s.mark === 'line')) return null

  const gutter = endLabelGutter({ labels: visible.map((s) => s.label), fontPx, plotWidth })
  if (gutter === null) return null

  const placed = visible.flatMap((s) => {
    const last = data.findLast((d) => s.getValue(d) !== null)
    if (last === undefined) return []
    const value = s.getValue(last)
    if (value === null) return []
    const y = yScale(value)
    return Number.isFinite(y) ? [{ series: s, y }] : []
  })
  if (placed.length !== visible.length) return null

  const lineHeight = Math.ceil(fontPx * END_LABEL_LINE_HEIGHT)
  const ys = nudgeLabels({
    ys: placed.map((p) => p.y),
    minGap: lineHeight,
    min: lineHeight / 2,
    max: yMax - lineHeight / 2,
  })
  if (ys === null) return null
  return { gutter, labels: placed.map((p, i) => ({ series: p.series, y: ys[i] ?? p.y })) }
}
