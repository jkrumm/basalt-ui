/**
 * The geometry seam's axis gaps, on both cartesian compilers: axis titles, a log x, vertical
 * reference rules and the dot / ring swatch. The 2.x path is `compileCartesian` from `./compile` and
 * `Lines`; the v3 path is `compileCartesian` from `./core/compile` and the v3 `CartesianChart`.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { logTicks } from './axis-gaps'
import { compileCartesian as compileV2 } from './compile'
import type { CartesianInput as InputV2 } from './compile'
import { compileCartesian as compileV3 } from './core/compile'
import type { CartesianInput as InputV3 } from './core/compile'
import { Lines } from './Lines'
import { toEngineSpec, toEngineSeries } from './parts/cartesian-adapt'
import { CartesianChart } from './parts/cartesian'
import { Legend } from './parts/legend'
import type { Series, SeriesColor } from './contract'
import type { ChartSeries } from './types'

type Row = { x: number; y: number }
const rows: Row[] = [1, 10, 100, 1000].map((x) => ({ x, y: x / 10 }))
const s: ChartSeries<Row> = {
  key: 'a',
  label: 'Alpha',
  color: 'var(--vx-line)',
  getValue: (d) => d.y,
}
const other: ChartSeries<Row> = { ...s, key: 'b', label: 'Beta' }
const WIDE = { width: 600, height: 240, defaultTheme: {} as never }

const base = {
  chartId: 'c',
  data: rows,
  x: (d: Row) => d.x,
  series: [s],
  marks: () => [],
}

const specOf = (input: InputV2<Row, number> | InputV3<Row, number>, v3: boolean) =>
  (v3 ? compileV3(input as InputV3<Row, number>) : compileV2(input as InputV2<Row, number>)).chart(
    WIDE,
  )

type Loose = {
  scale: { domain: () => unknown[]; (v: number): number | undefined }
  axis: {
    label?: { text: string }
    ticks: { values?: number[]; format: (v: number) => string }
    tickLabels: { dy: number }
  }
}

type Scales = {
  x: Loose
  y: Loose
  ytitle: Loose
  y2title?: Loose
  zx?: unknown
}

const paths = [
  ['2.x', false],
  ['v3', true],
] as const

describe.each(paths)('%s compileCartesian', (_name, v3) => {
  test('axis title: x through the engine axis label, y as a caption scale above the ticks', () => {
    const spec = specOf({ ...base, xTitle: 'Price', y: { title: 'Quality' } }, v3)
    const scales = spec.scales as Scales
    expect(scales['x'].axis.label?.text).toBe('Price')
    const title = scales['ytitle']
    expect(title.axis.ticks.format(1)).toBe('Quality')
    expect(title.axis.tickLabels.dy).toBeLessThan(0)
    expect(scales['y2title']).toBeUndefined()
  })

  test('no title: no extra scale, no label', () => {
    const scales = specOf(base, v3).scales as Scales
    expect(scales['ytitle']).toBeUndefined()
    expect(scales['x'].axis.label).toBeUndefined()
  })

  test("xScale 'log' puts a numeric x on decades and drops x <= 0 rows", () => {
    const withZero = [{ x: 0, y: 1 }, ...rows]
    const spec = specOf({ ...base, data: withZero, xScale: 'log' }, v3)
    const scales = spec.scales as Scales
    expect(scales['x'].scale.domain()).toEqual([1, 1000])
    expect(scales['x'].axis.ticks.values).toEqual([1, 10, 100, 1000])
    expect(scales['x'].scale(10)).toBeCloseTo(1 / 3, 5)
  })

  test("xScale 'log' on a Date x is ignored", () => {
    const dates = rows.map((r) => ({ ...r, x: new Date(Date.UTC(2026, 0, r.x)) }))
    const input = { ...base, data: dates, x: (d: { x: Date }) => d.x, xScale: 'log' as const }
    const compiled = v3 ? compileV3(input as never) : compileV2(input as never)
    const scales = compiled.chart(WIDE).scales as Scales
    expect(scales['x'].scale.domain()[0]).toBeInstanceOf(Date)
  })

  test('xRefLines: a full-height rule at the value, dashed, with a caption; off-domain draws none', () => {
    const count = (xRefLines: readonly { x: number; color: string; label?: string }[]): number =>
      specOf({ ...base, xRefLines }, v3).marks.length
    const none = count([])
    expect(count([{ x: 10, color: 'red' }])).toBe(none + 1)
    expect(count([{ x: 10, color: 'red', label: 'median' }])).toBe(none + 2)
    expect(count([{ x: 5000, color: 'red', label: 'off' }])).toBe(none)
    const spec = specOf({ ...base, xRefLines: [{ x: 10, color: 'red' }] }, v3)
    expect((spec.scales as Record<string, unknown>)['zx']).toBeDefined()
  })

  test('xRefLines does not change the y domain', () => {
    const plain = specOf(base, v3).scales as Scales
    const ruled = specOf({ ...base, xRefLines: [{ x: 10, color: 'red' }] }, v3).scales as Scales
    expect(ruled['y'].scale.domain()).toEqual(plain['y'].scale.domain())
  })
})

describe('log ticks', () => {
  test('decades, with 2 and 5 between when decades alone are too few', () => {
    expect(logTicks(1, 1000)).toEqual([1, 10, 100, 1000])
    expect(logTicks(10, 100)).toEqual([10, 20, 50, 100])
  })
})

describe('2.x components', () => {
  const lines = (extra: object) => (
    <Lines ariaLabel="L" data={rows} x={(d) => d.x} series={[s]} {...extra} />
  )
  test('a vertical rule renders in the server HTML', () => {
    const html = renderToString(
      lines({ xRefLines: [{ x: 10, color: 'var(--vx-bad)', label: 'limit' }] }),
    )
    expect(html).toContain('data-ts-key="xref-0"')
    expect(html).toContain('limit')
  })
  test('a y title renders in the server HTML', () => {
    expect(renderToString(lines({ y: { title: 'Seconds' }, xTitle: 'Price' }))).toContain('Seconds')
  })
  test('a dot series legends as a round swatch, a ring as a hollow one', () => {
    const dot = renderToString(lines({ series: [{ ...s, mark: 'dot' }, other] }))
    expect(dot).toContain('border-radius:50%')
    const ring = renderToString(lines({ series: [{ ...s, mark: 'ring' }, other] }))
    expect(ring).toContain('border:1.5px solid')
  })
})

describe('v3 CartesianChart', () => {
  const pair = (v: string): SeriesColor => ({ light: `var(--vx-${v})`, dark: `var(--vx-${v})` })
  const v: Series<Row> = {
    mark: 'dot',
    key: 'a',
    label: 'Alpha',
    color: pair('line'),
    y: (d) => d.y,
  }
  const w: Series<Row> = { ...v, mark: 'line', key: 'b', label: 'Beta' }
  const chart = (extra: object = {}) =>
    renderToString(
      <CartesianChart
        ariaLabel="C"
        data={rows}
        x={{ value: (d) => d.x }}
        series={[v, w]}
        {...extra}
      />,
    )

  test('a v3 dot series legends as dot', () => {
    expect(toEngineSeries(v).mark).toBe('dot')
    expect(chart()).toContain('border-radius:50%')
  })
  test('an axis: x refLine reaches the engine spec and the HTML', () => {
    const refLines = [{ axis: 'x' as const, value: 10, color: pair('bad'), label: 'median' }]
    const spec = toEngineSpec({
      ariaLabel: 'C',
      data: rows,
      x: { value: (d) => d.x },
      series: [v],
      refLines,
    })
    expect(spec.xRefLines?.[0]?.x).toBe(10)
    expect(spec.refLines).toEqual([])
    expect(chart({ refLines })).toContain('data-ts-key="xref-0"')
  })
  test('titles and log scale are carried into the engine spec', () => {
    const spec = toEngineSpec({
      ariaLabel: 'C',
      data: rows,
      x: { value: (d) => d.x, title: 'Price', scale: 'log' },
      y: { title: 'Quality' },
      series: [v],
    })
    expect(spec.xTitle).toBe('Price')
    expect(spec.xScale).toBe('log')
    expect(spec.y?.title).toBe('Quality')
  })
  test('the Legend swatch dot and ring', () => {
    const html = renderToString(
      <Legend
        entries={[
          { key: 'a', label: 'A', color: pair('line'), swatch: 'dot' },
          { key: 'b', label: 'B', color: pair('line'), swatch: 'ring' },
        ]}
      />,
    )
    expect(html).toContain('border-radius:50%')
    expect(html).toContain('border:1.5px solid')
  })
})
