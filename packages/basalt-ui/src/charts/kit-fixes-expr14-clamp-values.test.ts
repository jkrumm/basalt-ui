/**
 * Expression cycle 14 (`v3-expr-14-kit-fixes` 3a): a clamped value keeps its true value at a narrow
 * width too. When the spots beside its caret are taken, the value stands further down the plot under
 * its caret, and it is never dropped while a free spot on the plot exists.
 */
import { describe, expect, test } from 'bun:test'
import type { LabelBox } from './chart-labels'
import { offScaleMarks } from './core/axis-ext'
import type { ChartSeries } from './types'

type Row = { d: number; v: number }

const W = 300
const H = 160
const DOMAIN: readonly [number, number] = [0, 120]
/** One value past the top edge at the middle of a 390-wide plot; the other datum is inside the cap. */
const ROWS: Row[] = [
  { d: 0.2, v: 40 },
  { d: 0.5, v: 150 },
]
const SERIES = [
  {
    key: 'v',
    label: 'V',
    mark: 'line',
    color: 'var(--basalt-chart-1)',
    getValue: (d: Row) => d.v,
  },
] as unknown as ChartSeries<Row>[]

/** The marks a clamped datum draws: its caret, and its true value when one is written. */
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

describe('a clamped value keeps its true value', () => {
  test('with the spots beside its caret taken, the value still stands on the plot', () => {
    // A band of drawn line across the top of the plot: right and left of the caret are both in it.
    const band: LabelBox = { left: 0, top: 0, width: W, height: 22 }
    // The caret and its value, a mark each for the caret and the text.
    expect(capMarks([band])).toHaveLength(2)
  })

  test('with room beside the caret the value is written there', () => {
    expect(capMarks([])).toHaveLength(2)
  })
})
