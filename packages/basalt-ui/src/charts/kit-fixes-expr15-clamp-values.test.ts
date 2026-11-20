/**
 * Expression cycle 15 kit fixes, the clamped value (`v3-expr-15-kit-fixes` 1d): a value past a bounded
 * axis keeps its true value when no spot is free on the plot (n67 at 390: the caret carried no value).
 */
import { describe, expect, test } from 'bun:test'
import type { LabelBox } from './chart-labels'
import { offScaleMarks } from './core/axis-ext'
import type { ChartSeries } from './types'

type Row = { d: number; v: number }

const W = 300
const H = 160
const DOMAIN: readonly [number, number] = [0, 120]
const ROWS: Row[] = [
  { d: 0.2, v: 40 },
  { d: 0.5, v: 150 },
]
const SERIES = [
  { key: 'v', label: 'V', mark: 'line', color: 'var(--basalt-chart-1)', getValue: (d: Row) => d.v },
] as unknown as ChartSeries<Row>[]

function capMarks(obstacles: readonly LabelBox[]) {
  return offScaleMarks<Row, number>({
    series: SERIES,
    data: ROWS,
    x: (d) => d.d,
    fraction: (x) => x,
    domainOf: () => DOMAIN,
    yScaleOf: () => 'y',
    formatOf: () => (v) => `+${v - DOMAIN[1]} kg`,
    labels: { frame: () => ({ width: W, height: H }), obstacles: () => obstacles },
  })
}

describe('a clamped value keeps its true value when every spot is taken', () => {
  test('a plot covered by drawn marks still writes the value under its caret', () => {
    const everything: LabelBox = { left: 0, top: 0, width: W, height: H }
    expect(capMarks([everything])).toHaveLength(2)
  })
})
