/**
 * Expression cycle 16 kit fixes, end labels (`v3-expr-16-kit-fixes` 3, n79 `?fixture=surge`): a plan never drops an end
 * label. Eight lines converge on the plot's right edge at 390 and no height clears them all for some labels; a
 * chart named by `endLabels` has no legend, so a dropped label would leave its series unnamed. Every series
 * keeps its label, once. The browser half is `kit-expr16l-ends.layout.test.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { endLabelPlan } from './labels'
import type { ChartSeries, PlotContext } from './types'

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

describe('a plan keeps every end label (n79 surge)', () => {
  for (const [name, containerClass, width] of [
    ['390: eight converging lines', 'narrow', 312],
    ['wide: there is room', 'wide', 1000],
  ] as const) {
    test(`${name}, every series keeps its label`, () => {
      const ctx = plot(containerClass, width)
      const lines = ctx.visible as ChartSeries<number>[]
      const plan = endLabelPlan(ctx, lines, 'endLabels', [])
      expect(plan).toHaveLength(LINES.length)
      expect(plan.map((l) => l.series.label).toSorted()).toEqual(LINES.map(([l]) => l).toSorted())
    })
  }
})
