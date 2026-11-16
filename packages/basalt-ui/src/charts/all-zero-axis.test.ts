/** An axis whose series are all zero labels its baseline and invents no scale (`v3-expr-5-kit-fixes`). */
import { describe, expect, test } from 'bun:test'
import { compileCartesian } from './core/compile'
import type { CartesianInput } from './core/compile'
import type { ChartSeries } from './types'

describe('an all-zero axis', () => {
  type Row = { x: number; y: number }
  const series = (key: string): ChartSeries<Row> => ({
    key,
    label: key,
    color: 'var(--vx-line)',
    mark: 'line',
    getValue: (d) => d.y,
  })
  const input = (
    ys: readonly number[],
    extra: Partial<CartesianInput<Row, number>> = {},
  ): CartesianInput<Row, number> =>
    ({
      chartId: 'c',
      data: ys.map((y, x) => ({ x, y })),
      x: (d: Row) => d.x,
      series: [series('a')],
      marks: () => [],
      ...extra,
    }) as CartesianInput<Row, number>
  type Scales = { y: { axis: { ticks: { values?: number[]; count?: number } } } }
  const ticksOf = (given: CartesianInput<Row, number>) =>
    (
      compileCartesian(given).chart({ width: 600, height: 240, defaultTheme: {} as never })
        .scales as unknown as Scales
    ).y.axis.ticks

  test('labels the zero baseline alone, never a lone 1', () => {
    expect(ticksOf(input([0, 0, 0])).values).toEqual([0])
  })

  test('a nonzero value keeps the engine ticks', () => {
    const ticks = ticksOf(input([0, 0, 3]))
    expect(ticks.values).toBeUndefined()
    expect(ticks.count).toBeGreaterThan(0)
  })

  test('a reference line above zero keeps the scale it needs', () => {
    expect(ticksOf(input([0, 0], { refLines: [{ value: 5 } as never] })).values).toBeUndefined()
  })

  test('the page own domain wins', () => {
    expect(ticksOf(input([0, 0], { y: { domain: [0, 10] } })).values).toBeUndefined()
  })
})
