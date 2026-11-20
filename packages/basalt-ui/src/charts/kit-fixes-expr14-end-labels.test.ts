/**
 * Expression cycle 14 (`v3-expr-14-kit-fixes` 1): a line is named at half width and at 390, by its end label or,
 * where `auto` leaves the labels to the wide class, by the legend the card already shows. `endLabels` draws every
 * line's label at any width, and a displaced one carries a hairline and no stub.
 */
import { describe, expect, test } from 'bun:test'
import { endLabelMarks, endLabelPlan } from './labels'
import type { ChartSeries, PlotContext } from './types'

const NAMES = ['Spec', 'Build', 'Deploy']
const POINTS = 8

function plot(containerClass: 'micro' | 'narrow' | 'regular' | 'wide', width: number) {
  const lines = [
    [4, 5, 6, 7, 8, 9, 10, 11],
    [4, 4, 4, 5, 5, 5, 5, 5],
    [3, 3, 3, 3, 3, 3, 3, 4],
  ]
  const visible = lines.map((_, i) => ({ key: String(i), label: NAMES[i], mark: 'line' }))
  return {
    rows: (key: string) => (lines[Number(key)] ?? []).map((y, i) => ({ x: i, y, datum: i })),
    visible,
    containerClass,
    plotWidth: width,
    plotHeight: 140,
    width: width + 50,
    height: 180,
    y2: undefined,
    xFraction: (x: number) => x / (POINTS - 1),
    yDomain: [0, 12],
    data: [],
    highlighted: null,
    focused: null,
  } as unknown as PlotContext<number>
}

describe('a line is named at every width', () => {
  for (const [name, cls, width] of [
    ['half width', 'regular', 380],
    ['390', 'narrow', 300],
  ] as const) {
    test(`${name}: \`auto\` leaves the naming to the legend, \`endLabels\` draws every label`, () => {
      const ctx = plot(cls, width)
      const lines = ctx.visible as ChartSeries<number>[]
      expect(endLabelPlan(ctx, lines, 'auto', [])).toEqual([])
      const plan = endLabelPlan(ctx, lines, 'endLabels', [])
      expect(plan.map((l) => l.series.label).toSorted()).toEqual(['Build', 'Deploy', 'Spec'])
      const leaders = plan.filter((l) => l.leader !== undefined).length
      expect(endLabelMarks(plan)).toHaveLength(plan.length + leaders)
    })
  }
})
