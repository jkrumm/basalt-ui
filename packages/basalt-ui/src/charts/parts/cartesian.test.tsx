/**
 * `CartesianChart` behaviour no kind test covers: the hidden summary and data table, `selection` on
 * click and Enter and inert on the server, `CartesianChart.custom`, dot series and the seam registry.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { applySeams } from '../seams'
import type { Seam } from '../seams'
import type { Series, SeriesColor } from '../contract'
import { toEngineSpec } from './cartesian-adapt'
import { chartSelection, indexMap } from './cartesian-selection'
import { CartesianChart, TABLE_MAX_POINTS, autoSummary } from './cartesian'

const pair = (v: string): SeriesColor => ({ light: `var(--vx-${v})`, dark: `var(--vx-${v})` })
type Row = { t: number; v: number | null }
const rowsOf = (n: number): Row[] =>
  Array.from({ length: n }, (_, i) => ({ t: Date.UTC(2026, 8, 1) + i * 86_400_000, v: i + 1 }))
const x = { value: (d: Row): Date => new Date(d.t) }
const v: Series<Row> = {
  mark: 'line',
  key: 'v',
  label: 'Volume',
  color: pair('line'),
  y: (d) => d.v,
}

describe('summary', () => {
  test('states min, max and last of the first series when none is given', () => {
    expect(autoSummary({ data: rowsOf(4), series: [v] })).toBe('Volume: min 1, max 4, last 4')
  })
  test('reports an empty series as no data, never a number', () => {
    expect(autoSummary({ data: [], series: [v] })).toBe('Volume: no data')
  })
  test('a given summary wins and renders hidden but in the tree', () => {
    const html = renderToString(
      <CartesianChart
        ariaLabel="V"
        data={rowsOf(4)}
        x={x}
        series={[v]}
        summary="Rising all week"
      />,
    )
    expect(html).toContain('Rising all week')
    expect(html).toContain('data-basalt-chart-summary')
  })
})

describe('table opt-in', () => {
  const tableOf = (n: number, table?: boolean): string =>
    renderToString(
      <CartesianChart
        ariaLabel="V"
        data={rowsOf(n)}
        x={x}
        series={[v]}
        {...(table !== undefined && { table })}
      />,
    )
  const rows = (html: string): number => (html.match(/<tr>/g) ?? []).length

  test(`renders a hidden data table for ${TABLE_MAX_POINTS} points`, () => {
    const html = tableOf(TABLE_MAX_POINTS, true)
    expect(html).toContain('data-basalt-chart-table')
    expect(rows(html)).toBe(TABLE_MAX_POINTS + 1) // header row + one per point
    expect(html).toContain('<caption>V</caption>')
  })
  test('renders none above the cap', () => {
    expect(tableOf(TABLE_MAX_POINTS + 1, true)).not.toContain('data-basalt-chart-table')
  })
  test('is opt-in', () => {
    expect(tableOf(10)).not.toContain('data-basalt-chart-table')
  })
})

describe('selection', () => {
  const data = rowsOf(6)

  test('the engine controller proposes the datum on click and on Enter, and null on clear', () => {
    const calls: (Row | null)[] = []
    const controller = chartSelection(data, indexMap(data), {
      selected: null,
      onSelect: (d) => calls.push(d),
    })
    const row = { x: new Date(data[2]!.t), y: 3, series: 'v', datum: data[2]! }
    const point = { datum: row, xValue: row.x } as never
    controller.change(point, 'pointer')
    controller.change(point, 'keyboard')
    expect(calls).toEqual([data[2]!, data[2]!])
    // A blank-surface click clears only a selection that exists.
    const held = chartSelection(data, indexMap(data), {
      selected: data[2]!,
      onSelect: (d) => calls.push(d),
    })
    held.change(null, 'pointer')
    expect(calls.at(-1)).toBeNull()
  })

  test('the selected datum is drawn, and the server render is inert', () => {
    let called = 0
    const html = renderToString(
      <CartesianChart
        ariaLabel="V"
        data={data}
        x={x}
        series={[v]}
        selection={{ selected: data[2]!, onSelect: () => called++ }}
      />,
    )
    expect(html).toContain('data-ts-key="selection')
    expect(called).toBe(0)
  })
})

describe('marks', () => {
  test('CartesianChart.custom is the only way to build custom marks', () => {
    const marks = CartesianChart.custom<Row>(() => [])
    expect(marks.kind).toBe('custom-marks')
  })

  test('custom marks see datums of visible series and the plot height', () => {
    let seen: { rows: number; height: number; keys: string[] } | undefined
    renderToString(
      <CartesianChart
        ariaLabel="V"
        data={rowsOf(5)}
        x={x}
        series={[v]}
        marks={CartesianChart.custom<Row>((plot) => {
          seen = {
            rows: plot.rows('v').length,
            height: plot.plotHeight,
            keys: plot.visible.map((s) => s.key),
          }
          return []
        })}
      />,
    )
    expect(seen).toEqual({ rows: 5, height: expect.any(Number), keys: ['v'] })
  })

  test('a dot series draws one dot per row with a value', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToString(
      <CartesianChart
        ariaLabel="V"
        data={rowsOf(5)}
        x={x}
        series={[{ mark: 'dot', key: 'd', label: 'Dots', color: pair('accent'), y: (d) => d.v }]}
      />,
    )
    expect(host.querySelectorAll('g[data-ts-key="d"] circle').length).toBe(5)
  })
})

describe('seams', () => {
  const props = { data: rowsOf(3), x, series: [v] }
  test('the registry is identity until charts-2b fills it', () => {
    const spec = toEngineSpec({ ariaLabel: 'V', ...props })
    expect(applySeams(spec, props)).toBe(spec)
  })
  test('registered seams run in order and see the v3 props', () => {
    const tag =
      (name: string): Seam =>
      (spec) => ({ ...spec, cursorGroup: `${spec.cursorGroup ?? ''}${name}` })
    const spec = toEngineSpec({ ariaLabel: 'V', ...props })
    expect(applySeams(spec, props, [tag('a'), tag('b')]).cursorGroup).toBe('ab')
  })
})
