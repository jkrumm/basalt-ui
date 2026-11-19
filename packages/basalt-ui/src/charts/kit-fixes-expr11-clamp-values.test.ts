/**
 * Expression cycle 11 (`v3-expr-11-kit-fixes` 4): every bar clamped by a bounded `y.domain` shows its
 * true value beside its caret, and the value is never dropped when its neighbours crowd it. The
 * caret is the edge's mark; a value that covers it hides the one thing that says "past the edge".
 */
import { describe, expect, test } from 'bun:test'
import { CARET_SIZE } from './core/axis-ext'
import { barValueLabels } from './core/bar-values'
import type { ChartSeries } from './types'

type Row = { x: number; v: number }

const W = 300
const H = 160
const CAP = 10

/** One bar series labelled with its values, on a `[0, CAP]` axis; `rows` are evenly spaced bars. */
function run(values: readonly number[], highlighted: (i: number) => boolean = () => false) {
  const rows: Row[] = values.map((v, x) => ({ x, v }))
  const n = rows.length
  const series = [
    {
      key: 'cost',
      label: 'Cost',
      mark: 'bar',
      color: 'var(--basalt-chart-1)',
      getValue: (d: Row) => d.v,
      values: true,
      highlight: (d: Row) => highlighted(d.x),
    },
  ] as unknown as ChartSeries<Row>[]
  const result = barValueLabels<Row, number>({
    series,
    data: rows,
    x: (d) => d.x,
    fraction: (x) => (x + 0.5) / n,
    barHalf: 0.4 / n,
    stack: undefined,
    sideOf: () => 'left',
    domainOf: () => [0, CAP],
    scaleOf: () => 'y',
    formatOf: () => (v) => `$${v.toFixed(1)}`,
    frame: { width: W, height: H },
    focused: null,
    obstacles: [],
    clear: [],
  })
  const caretAt = (x: number) => ((x + 0.5) / n) * W
  return { ...result, caretAt, clamped: rows.filter((r) => r.v > CAP) }
}

describe('a clamped bar keeps its true value', () => {
  test('every clamped bar is labelled, even when its neighbours crowd it', () => {
    const out = run([3, 12, 4, 15, 5, 11, 2, 6, 14])
    for (const r of out.clamped)
      expect(out.written.has(`cost:${(r.x + 0.5) / 9}`), `bar ${r.x}`).toBe(true)
  })

  test('the three clamped bars of a cloudburst each carry a number, the top one is not the only one', () => {
    const out = run([1, 2, 30, 4, 25, 3, 2, 28, 2, 1], (i) => i === 2)
    expect(out.clamped.length).toBe(3)
    for (const r of out.clamped)
      expect(out.written.has(`cost:${(r.x + 0.5) / 10}`), `bar ${r.x}`).toBe(true)
  })

  test('no value label covers the caret of a clamped bar', () => {
    const out = run([3, 12, 4, 15, 5, 11, 2, 6, 14], (i) => i === 3)
    for (const r of out.clamped) {
      const cx = out.caretAt(r.x)
      const covers = out.boxes.some(
        (b) =>
          b.left < cx + 4 &&
          b.left + b.width > cx - 4 &&
          b.top < CARET_SIZE &&
          b.top + b.height > 0,
      )
      expect(covers, `caret of bar ${r.x}`).toBe(false)
    }
  })
})
