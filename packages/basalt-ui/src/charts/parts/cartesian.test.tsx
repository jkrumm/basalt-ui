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

const pair = (v: string): SeriesColor => ({
  light: `var(--basalt-${v})`,
  dark: `var(--basalt-${v})`,
})
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
  test('a series past the argument-spread limit still summarizes', () => {
    const big = rowsOf(200_000)
    expect(autoSummary({ data: big, series: [v] })).toBe('Volume: min 1, max 200k, last 200k')
  })
  test('a given summary wins and renders hidden but in the tree', () => {
    const html = renderToString(
      <CartesianChart label="V" data={rowsOf(4)} x={x} series={[v]} summary="Rising all week" />,
    )
    expect(html).toContain('Rising all week')
    expect(html).toContain('data-basalt-chart-summary')
  })
})

describe('table opt-in', () => {
  const tableOf = (n: number, table?: boolean): string =>
    renderToString(
      <CartesianChart
        label="V"
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
        label="V"
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
        label="V"
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

  test('a dot series with spread draws coincident dots apart', () => {
    const same: Row[] = [0, 1, 2].map(() => ({ t: Date.UTC(2026, 8, 1), v: 5 }))
    // The drawn centres of the three coincident dots, read off the server render.
    const centres = (spread?: 'x'): string[] => {
      const html = renderToString(
        <CartesianChart
          label="V"
          data={[...same, { t: Date.UTC(2026, 8, 30), v: 1 }]}
          x={x}
          y={{ domain: [0, 10] }}
          series={[
            {
              mark: 'dot',
              key: 'v',
              label: 'V',
              color: pair('dot'),
              y: (d) => d.v,
              ...(spread !== undefined && { spread }),
            },
          ]}
        />,
      )
      return [...html.matchAll(/<circle[^>]*cx="([^"]+)"/g)].slice(0, 3).map((m) => m[1] ?? '')
    }
    expect(new Set(centres()).size).toBe(1)
    expect(new Set(centres('x')).size).toBe(3)
  })

  test('custom marks get pixel positions on the axis scales', () => {
    let seen:
      | {
          x0: number | null
          x4: number | null
          off: number | null
          top: number
          bottom: number
          width: number
          height: number
        }
      | undefined
    renderToString(
      <CartesianChart
        label="V"
        data={rowsOf(5)}
        x={x}
        y={{ domain: [0, 10] }}
        series={[v]}
        marks={CartesianChart.custom<Row>((plot) => {
          const first = rowsOf(5)[0]?.t ?? 0
          seen = {
            x0: plot.x(new Date(first)),
            x4: plot.x(new Date(first + 4 * 86_400_000)),
            off: plot.x('not a date'),
            top: plot.y(10),
            bottom: plot.y(0),
            width: plot.plotWidth,
            height: plot.plotHeight,
          }
          return []
        })}
      />,
    )
    expect(seen?.x0).toBe(0)
    expect(seen?.x4).toBeCloseTo(seen?.width ?? -1, 6)
    expect(seen?.off).toBeNull()
    expect(seen?.top).toBe(0)
    expect(seen?.bottom).toBeCloseTo(seen?.height ?? -1, 6)
  })

  test('an x zone is an x range with a y bound; a y zone stays a y band', () => {
    const spec = toEngineSpec({
      label: 'V',
      data: rowsOf(3),
      x,
      series: [v],
      zones: [
        { from: 1, to: 2, fill: 'var(--basalt-good)' },
        {
          axis: 'x',
          from: new Date(0),
          to: new Date(1),
          fill: 'var(--basalt-bad)',
          y: { from: 0, to: 5 },
          label: 'Window',
        },
        { axis: 'x', from: 'Mon', to: 'Tue', fill: 'var(--basalt-bad)' },
      ],
    })
    expect(spec.zones).toEqual([{ from: 1, to: 2, fill: 'var(--basalt-good)' }])
    expect(spec.xZones).toEqual([
      {
        from: new Date(0),
        to: new Date(1),
        fill: 'var(--basalt-bad)',
        y: { from: 0, to: 5 },
        label: 'Window',
      },
      { from: 'Mon', to: 'Tue', fill: 'var(--basalt-bad)', align: 'edge' },
    ])
  })

  test('a labelled x zone draws its band and its caption', () => {
    const host = document.createElement('div')
    const first = rowsOf(5)[0]?.t ?? 0
    host.innerHTML = renderToString(
      <CartesianChart
        label="V"
        data={rowsOf(5)}
        x={x}
        series={[v]}
        zones={[
          {
            axis: 'x',
            from: new Date(first + 86_400_000),
            to: new Date(first + 3 * 86_400_000),
            y: { from: 2, to: 4 },
            fill: 'var(--basalt-brand)',
            label: 'Window',
          },
        ]}
      />,
    )
    expect(host.querySelector('[data-ts-key="xzone-0"]')).not.toBeNull()
    expect(host.textContent).toContain('Window')
  })

  test('a dot series draws one dot per row with a value', () => {
    const host = document.createElement('div')
    host.innerHTML = renderToString(
      <CartesianChart
        label="V"
        data={rowsOf(5)}
        x={x}
        series={[{ mark: 'dot', key: 'd', label: 'Dots', color: pair('accent'), y: (d) => d.v }]}
      />,
    )
    expect(host.querySelectorAll('g[data-ts-key="d"] circle').length).toBe(5)
  })
})

describe('legend naming', () => {
  const dots: Series<Row> = {
    mark: 'dot',
    key: 'd',
    label: 'Spikes',
    color: pair('accent'),
    y: (d) => d.v,
  }
  const hideWide = (series: Series<Row>[]): boolean =>
    renderToString(<CartesianChart label="V" data={rowsOf(4)} x={x} series={series} />).includes(
      'data-hide-wide',
    )

  test('lines alone hand the legend to end labels at the wide class', () => {
    expect(hideWide([v, { ...v, key: 'w', label: 'Other' }])).toBe(true)
  })
  test('a dot series keeps the legend: end labels never name it', () => {
    expect(hideWide([v, dots])).toBe(false)
  })
})

describe('seams', () => {
  const props = { data: rowsOf(3), x, series: [v] }
  test('the registry is identity until charts-2b fills it', () => {
    const spec = toEngineSpec({ label: 'V', ...props })
    expect(applySeams(spec, props)).toBe(spec)
  })
  test('registered seams run in order and see the v3 props', () => {
    const tag =
      (name: string): Seam =>
      (spec) => ({ ...spec, cursorGroup: `${spec.cursorGroup ?? ''}${name}` })
    const spec = toEngineSpec({ label: 'V', ...props })
    expect(applySeams(spec, props, [tag('a'), tag('b')]).cursorGroup).toBe('ab')
  })
})
