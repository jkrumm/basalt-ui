/**
 * What a host chart lays under the marks a page draws through `CartesianChart.custom`, as boxes in
 * the plot's own px (from its top left, the space `ChartPlot.x` and `ChartPlot.y` answer in): the
 * zone and rule captions, the end labels, the line paths and the bodies of the bars. While the
 * host builds the custom marks it publishes them here, and `chartLabels.place` adds them to the
 * obstacles a page passes, so a placed label clears what the page cannot see. Outside a host (a
 * hand-built SVG) nothing is published and `place` is as it was.
 *
 * A module-level scope rather than a `ChartPlot` field: the contract stays as it is, and a builder
 * changes nothing. The scope is synchronous (`build` runs inside it, and an async read sees none).
 */
import type { LabelBox } from './chart-labels'
import type { LabelBox as ValueBox } from './ref-label'

/** A plot's width and height in px. */
export type PlotPx = { width: number; height: number }

/** Air a line path keeps round its stroke, px: half the stroke is already in the box. */
const LINE_AIR = 1.5
/** The longest stretch of a path one box covers, px: a long diagonal is many small boxes, not one tall one. */
const PIECE_PX = 6

let current: (() => readonly LabelBox[]) | undefined

/** Runs `run` with `boxes` as the host's obstacles; read lazily, once, on the first `place`. */
export function withHostObstacles<T>(boxes: () => readonly LabelBox[], run: () => T): T {
  const before = current
  let memo: readonly LabelBox[] | undefined
  current = () => (memo ??= boxes())
  try {
    return run()
  } finally {
    current = before
  }
}

/** The boxes the host published for the marks being built; none outside a host. */
export const hostObstacles = (): readonly LabelBox[] => current?.() ?? []

/** A box in a share of the plot width and a span of values on an axis with `domain`, as plot px. */
export function pxBox(box: ValueBox, domain: readonly [number, number], plot: PlotPx): LabelBox {
  const [lo, hi] = [Math.min(...domain), Math.max(...domain)]
  const span = hi - lo || 1
  const yPx = (v: number): number => ((hi - v) / span) * plot.height
  const top = yPx(Math.max(box.y0, box.y1))
  const bottom = yPx(Math.min(box.y0, box.y1))
  return {
    left: box.fx0 * plot.width,
    top,
    width: (box.fx1 - box.fx0) * plot.width,
    height: bottom - top,
  }
}

/** A caption box a share of the plot width wide, `top` to `bottom` px below the plot's top. */
export const captionPx = (
  box: { fx0: number; fx1: number; top: number; bottom: number },
  plot: PlotPx,
): LabelBox => ({
  left: box.fx0 * plot.width,
  top: box.top,
  width: (box.fx1 - box.fx0) * plot.width,
  height: box.bottom - box.top,
})

/**
 * A line path as boxes: each stretch of at most {@link PIECE_PX} gets the box of its two ends, so a
 * diagonal costs the label only the room under it. A run of one point is a small box. `runs` are
 * polylines in plot px, broken where the line has a gap.
 */
export function pathBoxes(
  runs: readonly (readonly { x: number; y: number }[])[],
  strokePx: number,
): LabelBox[] {
  const reach = strokePx / 2 + LINE_AIR
  const out: LabelBox[] = []
  const add = (x0: number, y0: number, x1: number, y1: number): void => {
    out.push({
      left: Math.min(x0, x1) - reach,
      top: Math.min(y0, y1) - reach,
      width: Math.abs(x1 - x0) + 2 * reach,
      height: Math.abs(y1 - y0) + 2 * reach,
    })
  }
  for (const run of runs) {
    const first = run[0]
    if (first === undefined) continue
    if (run.length === 1) add(first.x, first.y, first.x, first.y)
    for (let i = 1; i < run.length; i++) {
      const a = run[i - 1] as { x: number; y: number }
      const b = run[i] as { x: number; y: number }
      const pieces = Math.max(
        1,
        Math.ceil(Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y)) / PIECE_PX),
      )
      for (let p = 0; p < pieces; p++) {
        const t0 = p / pieces
        const t1 = (p + 1) / pieces
        add(
          a.x + (b.x - a.x) * t0,
          a.y + (b.y - a.y) * t0,
          a.x + (b.x - a.x) * t1,
          a.y + (b.y - a.y) * t1,
        )
      }
    }
  }
  return out
}
