/**
 * Expression cycle 14 (`v3-expr-14-kit-fixes` 2): a stack total sits above its stack, never inside its
 * top segment, and a kept value stays centred over its own bar, never shifted into a neighbour's slot.
 */
import { describe, expect, test } from 'bun:test'
import type { LabelBox } from './chart-labels'
import { barValueLabels } from './core/bar-values'
import type { ChartSeries } from './types'

type Row = { x: number; a: number; b: number }

const W = 300
const H = 160
const CENTRE_OF_MIDDLE = (1 + 0.5) * (W / 3)

const STACKED = [
  {
    key: 'a',
    label: 'A',
    mark: 'bar',
    color: 'var(--basalt-chart-1)',
    getValue: (d: Row) => d.a,
    values: true,
  },
  {
    key: 'b',
    label: 'B',
    mark: 'bar',
    color: 'var(--basalt-chart-2)',
    getValue: (d: Row) => d.b,
    values: true,
  },
] as unknown as ChartSeries<Row>[]

const GROUPED = [
  {
    key: 'a',
    label: 'A',
    mark: 'bar',
    color: 'var(--basalt-chart-1)',
    getValue: (d: Row) => d.a,
    values: true,
    highlight: (d: Row) => d.x === 5,
  },
] as unknown as ChartSeries<Row>[]

function place(
  series: ChartSeries<Row>[],
  rows: Row[],
  obstacles: readonly LabelBox[],
  stack: 'stacked' | undefined,
  barHalf: number,
) {
  return barValueLabels<Row, number>({
    series,
    data: rows,
    x: (d) => d.x,
    fraction: (x) => (x + 0.5) / rows.length,
    barHalf,
    stack,
    sideOf: () => 'left',
    domainOf: () => [0, 100],
    scaleOf: () => 'y',
    formatOf: () => (v) => String(v),
    frame: { width: W, height: H },
    focused: null,
    obstacles,
    clear: obstacles,
  })
}

const near = (box: LabelBox, x: number, reach: number): boolean =>
  Math.abs(box.left + box.width / 2 - x) < reach

const meets = (a: LabelBox, b: LabelBox): boolean =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height

describe('a stack total sits above its stack', () => {
  // The middle stack totals 60, so its top is 64 px down the 160 px plot. A caption covers the spot
  // straight above it: the total must go above its stack anyway, never into the top segment.
  const rows: Row[] = [
    { x: 0, a: 20, b: 10 },
    { x: 1, a: 30, b: 30 },
    { x: 2, a: 10, b: 5 },
  ]
  const STACK_TOP = H * (1 - 60 / 100)
  const caption: LabelBox = { left: CENTRE_OF_MIDDLE - 20, top: 44, width: 40, height: 17 }

  test('with a caption over the spot above it, the total is never written inside its stack', () => {
    const out = place(STACKED, rows, [caption], 'stacked', 0.05)
    const total = out.boxes.filter((b) => near(b, CENTRE_OF_MIDDLE, 20))
    for (const box of total) expect(box.top + box.height).toBeLessThanOrEqual(STACK_TOP + 0.5)
  })

  test('with a rule over the spot above it, the total is never written over the rule', () => {
    const rule: LabelBox = { left: 0, top: 58, width: W, height: 4 }
    const out = place(STACKED, rows, [rule], 'stacked', 0.05)
    const total = out.boxes.filter((b) => near(b, CENTRE_OF_MIDDLE, 20))
    for (const box of total) {
      expect(box.top + box.height).toBeLessThanOrEqual(STACK_TOP + 0.5)
      expect(meets(box, rule), 'over the rule').toBe(false)
    }
  })

  test('with nothing in the way the total stays above its stack', () => {
    const out = place(STACKED, rows, [], 'stacked', 0.05)
    const total = out.boxes.filter((b) => near(b, CENTRE_OF_MIDDLE, 20))
    expect(total).toHaveLength(1)
    expect(total[0]!.top + total[0]!.height).toBeLessThanOrEqual(STACK_TOP + 0.5)
  })
})

describe('a kept value stays inside its own bar slot', () => {
  // Twelve narrow bars; the named one's spot above it is crossed by a rule. The old placer moved its
  // value sideways onto the free spot beside the bar's end, across the midpoint into the next slot.
  const COUNT = 12
  const SLOT = W / COUNT
  const NAMED = 5
  const rows: Row[] = Array.from({ length: COUNT }, (_, x) => ({
    x,
    a: x === NAMED ? 60 : 30,
    b: 0,
  }))
  const rule: LabelBox = { left: 0, top: 52, width: W, height: 4 }
  const centre = (NAMED + 0.5) * SLOT

  test('the named value is written over the rule if it must, inside its own slot', () => {
    const out = place(GROUPED, rows, [rule], undefined, 0.01)
    const named = out.boxes.filter((b) => near(b, centre, SLOT / 2))
    expect(named).toHaveLength(1)
    const box = named[0]!
    expect(box.left, 'left of its slot').toBeGreaterThanOrEqual(centre - SLOT / 2)
    expect(box.left + box.width, 'right of its slot').toBeLessThanOrEqual(centre + SLOT / 2)
  })
})
