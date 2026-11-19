/**
 * Expression cycle 11 (`v3-expr-11-kit-fixes` 5): a bar value that names the answer is kept even where
 * rules close every spot beside it, but it crosses a rule, never a caption. A reference or zone
 * caption is text: a value written over it hides both.
 */
import { describe, expect, test } from 'bun:test'
import type { LabelBox } from './chart-labels'
import { barValueLabels } from './core/bar-values'
import type { ChartSeries } from './types'

type Row = { x: number; v: number }

const W = 300
const H = 160
const ROWS: Row[] = [
  { x: 0, v: 3 },
  { x: 1, v: 7 },
  { x: 2, v: 4 },
  { x: 3, v: 2 },
]
const SERIES = [
  {
    key: 'v',
    label: 'V',
    mark: 'bar',
    color: 'var(--basalt-chart-1)',
    getValue: (d: Row) => d.v,
    values: true,
    highlight: (d: Row) => d.x === 1,
  },
] as unknown as ChartSeries<Row>[]
const CX = (1 + 0.5) * (W / 4)

const meet = (a: LabelBox, b: LabelBox): boolean =>
  a.left < b.left + b.width &&
  b.left < a.left + a.width &&
  a.top < b.top + b.height &&
  b.top < a.top + a.height

function place(obstacles: readonly LabelBox[]) {
  return barValueLabels<Row, number>({
    series: SERIES,
    data: ROWS,
    x: (d) => d.x,
    fraction: (x) => (x + 0.5) / 4,
    barHalf: 0.012,
    stack: undefined,
    sideOf: () => 'left',
    domainOf: () => [0, 10],
    scaleOf: () => 'y',
    formatOf: () => (v) => String(v),
    frame: { width: W, height: H },
    focused: null,
    obstacles,
    clear: obstacles,
  })
}

describe('the value that names the answer keeps clear of a caption', () => {
  // Two rules close every spot beside the bar's end; a caption sits over the spot straight above it.
  const rules: LabelBox[] = [
    { left: 0, top: 34, width: W, height: 4 },
    { left: 0, top: 46, width: W, height: 4 },
  ]
  const caption: LabelBox = { left: CX - 60, top: 26, width: 62, height: 17 }

  test('it is written, over a rule if it must, and not over the caption', () => {
    const out = place([...rules, caption])
    expect(out.written.size, 'the named bar is labelled').toBeGreaterThan(0)
    const named = out.boxes.filter((b) => Math.abs(b.left + b.width / 2 - CX) < 30)
    expect(named.length).toBeGreaterThan(0)
    for (const box of named) expect(meet(box, caption), 'over the caption').toBe(false)
  })

  test('with no spot clear of the caption it is still written, not dropped', () => {
    const wide: LabelBox = { left: 0, top: 0, width: W, height: H }
    expect(place([...rules, wide]).written.size).toBeGreaterThan(0)
  })
})
