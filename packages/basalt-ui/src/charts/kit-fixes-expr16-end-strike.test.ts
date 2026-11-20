/**
 * Expression cycle 16 kit fixes, end labels (`v3-expr-16-kit-fixes` 3, n79 `?fixture=surge`): a displaced end label
 * is never struck through by another line. Eight lines converge on the plot's right edge at 390 and no height
 * is clear of them all for most labels: those are dropped (the legend names the series), and the ones kept have
 * no line through their glyphs. A wide plot has room and keeps every label. The browser half is
 * `kit-expr16l-ends.layout.test.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { endLabelPlan } from './labels'
import type { EndLabel } from './labels'
import type { ChartSeries, ChartX, PlotContext } from './types'

const WINDOWS = 4
const HEIGHT = 248
/** The n79 surge: eight classes over four windows, one of them far off the axis. */
const LINES: readonly (readonly [string, readonly number[]])[] = [
  ['Lint', [15, 10, 7, 6]],
  ['Type errors', [12, 11, 8, 6]],
  ['Build config', [9, 7, 5, 4]],
  ['Dependency bumps', [8, 7, 5, 4]],
  ['Deploy scripts', [6, 4, 3, 3]],
  ['Docs drift', [5, 4, 3, 2]],
  ['Migrations', [0, 0, 0, 0]],
  ['Flaky tests', [4, 3, 3, 38]],
]
const DOMAIN = [0, 20] as const
/** A glyph's advance, px: the micro size at half an em. */
const GLYPH_PX = 5.5
/** Half a label's ink, px (`BASALT.text.micro` at 0.75, halved). */
const INK_HALF = 4.1

function plot(containerClass: 'narrow' | 'wide', plotWidth: number) {
  const visible = LINES.map(([label], i) => ({ key: String(i), label, mark: 'line' }))
  return {
    rows: (key: string) => (LINES[Number(key)]?.[1] ?? []).map((y, i) => ({ x: i, y, datum: i })),
    visible,
    containerClass,
    plotWidth,
    plotHeight: HEIGHT,
    width: plotWidth + 50,
    height: HEIGHT + 60,
    y2: undefined,
    // A band axis: the last point sits half a slot in from the plot's right edge.
    xFraction: (x: number) => (x + 0.5) / WINDOWS,
    yDomain: DOMAIN,
    data: [],
    highlighted: null,
    focused: null,
  } as unknown as PlotContext<number>
}

/** Whether a line other than the label's own passes through the label's glyphs (px, from the plot's left and bottom). */
function struckBy(ctx: PlotContext<number>, plan: readonly EndLabel<number, ChartX>[]) {
  const [lo, hi] = DOMAIN
  const toPx = (v: number): number => ((v - lo) / (hi - lo)) * HEIGHT
  return plan.flatMap((label) => {
    // The glyphs, not the claimed box (which errs wide, with two px of margin): the shipped face is about
    // half its size per character.
    const glyphs = label.series.label.length * GLYPH_PX
    const left =
      label.anchor === 'end'
        ? label.box.fx1 * ctx.plotWidth - 2 - glyphs
        : label.box.fx0 * ctx.plotWidth + 2
    const right = left + glyphs
    const middle = (toPx(label.box.y0) + toPx(label.box.y1)) / 2
    return ctx.visible
      .filter((s) => s.key !== label.series.key)
      .filter((s) => {
        const rows = ctx.rows(s.key)
        return rows.slice(1).some((to, k) => {
          const from = rows[k]!
          const [x0, y0] = [ctx.xFraction(from.x)! * ctx.plotWidth, toPx(from.y!)]
          const [x1, y1] = [ctx.xFraction(to.x)! * ctx.plotWidth, toPx(to.y!)]
          for (let at = 0; at <= 1; at += 1 / 400) {
            const [x, y] = [x0 + (x1 - x0) * at, y0 + (y1 - y0) * at]
            if (x > left && x < right && Math.abs(y - middle) < INK_HALF) return true
          }
          return false
        })
      })
      .map((s) => `${label.series.label} struck by ${s.label}`)
  })
}

describe('a displaced end label is not struck by another line (n79 surge)', () => {
  test('390: eight converging lines keep only the labels no line runs through', () => {
    const ctx = plot('narrow', 312)
    const lines = ctx.visible as ChartSeries<number>[]
    const plan = endLabelPlan(ctx, lines, 'endLabels', [])
    expect(struckBy(ctx, plan)).toEqual([])
    // Some are dropped for want of a free height (the legend names them): not all eight, not none.
    expect(plan.length).toBeGreaterThan(0)
    expect(plan.length).toBeLessThan(LINES.length)
  })

  test('wide: there is room, every label is kept and none is struck', () => {
    const ctx = plot('wide', 1000)
    const lines = ctx.visible as ChartSeries<number>[]
    const plan = endLabelPlan(ctx, lines, 'endLabels', [])
    expect(plan).toHaveLength(LINES.length)
    expect(struckBy(ctx, plan)).toEqual([])
  })
})
