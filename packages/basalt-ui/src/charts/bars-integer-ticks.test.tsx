/**
 * A count axis (a bar series of whole numbers) ticks on integers: a
 * day's two events read `0 1 2`, never `0 0.5 1 1.5 2`. A fractional bar, a normalized stack and a
 * caller's own ticks keep what they had.
 */
import { describe, expect, test } from 'bun:test'
import { compileCartesian } from './core/compile'
import type { CartesianInput } from './core/compile'
import type { ChartSeries } from './types'

type Row = { x: number; y: number }

const bar = (getValue: (d: Row) => number): ChartSeries<Row> => ({
  key: 'a',
  label: 'Alpha',
  color: 'var(--vx-line)',
  mark: 'bar',
  getValue,
})

const WIDE = { width: 600, height: 240, defaultTheme: {} as never }
const input = (
  data: readonly number[],
  extra: Partial<CartesianInput<Row, number>> = {},
): CartesianInput<Row, number> =>
  ({
    chartId: 'c',
    data: data.map((y, x) => ({ x, y })),
    x: (d: Row) => d.x,
    series: [bar((d) => d.y)],
    marks: () => [],
    ...extra,
  }) as CartesianInput<Row, number>

type Scales = { y: { axis: { ticks: { values?: number[]; count?: number } } } }

describe('count axis', () => {
  const ticksOf = (given: CartesianInput<Row, number>) =>
    (compileCartesian(given).chart(WIDE).scales as unknown as Scales).y.axis.ticks

  test('integer counts tick on integers only', () => {
    const { values } = ticksOf(input([0, 1, 2, 1, 0]))
    expect(values).toBeDefined()
    expect(values?.every(Number.isInteger)).toBe(true)
    expect(values?.length).toBeGreaterThanOrEqual(2)
  })

  test('a fractional bar keeps the engine count', () => {
    const ticks = ticksOf(input([0.5, 1.25, 2.1]))
    expect(ticks.values).toBeUndefined()
    expect(ticks.count).toBeGreaterThan(0)
  })

  test('a normalized stack keeps the engine count', () => {
    expect(ticksOf(input([1, 2, 3], { stack: 'normalized' })).values).toBeUndefined()
  })

  test('the caller own ticks win', () => {
    expect(ticksOf(input([1, 2], { y: { ticks: [0, 5] } })).values).toEqual([0, 5])
  })
})
