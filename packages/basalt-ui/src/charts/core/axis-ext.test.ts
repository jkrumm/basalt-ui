/** Band tick stride, x tick lists, `at` rule edges, y bounds with off-scale carets, and the y tick format. */
import { describe, expect, test } from 'bun:test'
import type { CartesianChartProps, Series } from '../contract'
import { toEngineSpec } from '../parts/cartesian-adapt'
import type { ChartSeries, PlotContext } from '../types'
import {
  clampToDomain,
  edgeFraction,
  matchBandKeys,
  offScaleMarks,
  offScaleSide,
  strideKeepEnds,
} from './axis-ext'
import { compileCartesian, xGuide } from './compile'
import { xScaleFor } from './scales'

const color = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }

describe('strideKeepEnds', () => {
  test('keeps the first and the last at an even stride', () => {
    expect(strideKeepEnds(['a', 'b', 'c', 'd', 'e'], 3)).toEqual(['a', 'c', 'e'])
    expect(
      strideKeepEnds(
        Array.from({ length: 50 }, (_, i) => i),
        4,
      ),
    ).toEqual([0, 16, 33, 49])
  })
  test('a count at or past the length labels all, one labels the first', () => {
    expect(strideKeepEnds([1, 2, 3], 3)).toEqual([1, 2, 3])
    expect(strideKeepEnds([1, 2, 3], 9)).toEqual([1, 2, 3])
    expect(strideKeepEnds([1, 2, 3], 1)).toEqual([1])
    expect(strideKeepEnds([], 3)).toEqual([])
  })
  test('two labels are the two ends', () => {
    expect(strideKeepEnds(['a', 'b', 'c', 'd'], 2)).toEqual(['a', 'd'])
  })
})

describe('x ticks on a band axis', () => {
  const stages = ['Plan', 'Search docs', 'Read files', 'Call model', 'Verify']
  const model = xScaleFor<string>(stages, true)
  const ticks = (xTicks: number | readonly string[] | undefined): readonly unknown[] => {
    const guide = xGuide({ model, xTicks, cls: 'narrow' })
    return (guide.axis as unknown as { ticks: { values: unknown[] } }).ticks.values
  }

  test('a number is the most labels, first and last kept', () => {
    expect(ticks(3)).toEqual(['Plan', 'Read files', 'Verify'])
  })
  test('without ticks every band keeps its label (the engine thins the collisions)', () => {
    expect(ticks(undefined)).toEqual(stages)
  })
  test('a list labels exactly those keys, unknown keys dropped', () => {
    expect(ticks(['Verify', 'Plan', 'Nope'])).toEqual(['Verify', 'Plan'])
  })
  test('a numeric band axis prints exactly the listed bins; Dates match by timestamp', () => {
    const bins = Array.from({ length: 50 }, (_, i) => i / 50)
    expect(matchBandKeys(bins, [0, 0.24, 0.5, 0.74])).toEqual([0, 0.24, 0.5, 0.74])
    const days = [new Date(Date.UTC(2026, 0, 1)), new Date(Date.UTC(2026, 0, 2))]
    expect(matchBandKeys(days, [new Date(Date.UTC(2026, 0, 2))])).toEqual([days[1] as Date])
  })
  test('a band of 30 days with ticks: 3 labels the first, middle and last day', () => {
    const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 0, 1 + i)))
    const guide = xGuide({ model: xScaleFor(days, true), xTicks: 3, cls: 'narrow' })
    const values = (guide.axis as unknown as { ticks: { values: Date[] } }).ticks.values
    expect(values.map((d) => d.getUTCDate())).toEqual([1, 16, 30])
  })
  test('a continuous axis keeps the number as the tick count', () => {
    const guide = xGuide({ model: xScaleFor([0, 10, 20], false), xTicks: 4, cls: 'narrow' })
    expect((guide.axis as unknown as { ticks: { count: number } }).ticks.count).toBe(4)
  })
})

describe('edgeFraction', () => {
  const band = xScaleFor<string>(['a', 'b', 'c', 'd'], true)
  test('centre is the band centre; start and end sit half a step either side', () => {
    const centre = band.fraction('b') as number
    expect(edgeFraction(band, 'b', undefined)).toBe(centre)
    expect(edgeFraction(band, 'b', 'centre')).toBe(centre)
    expect(edgeFraction(band, 'b', 'start')).toBeCloseTo(centre - band.halfStep)
    expect(edgeFraction(band, 'b', 'end')).toBeCloseTo(centre + band.halfStep)
  })
  test('the rule falls between the neighbouring bars', () => {
    const rule = edgeFraction(band, 'b', 'start') as number
    expect(rule).toBeCloseTo(((band.fraction('a') as number) + (band.fraction('b') as number)) / 2)
  })
  test('the first start and the last end stay inside the plot', () => {
    expect(edgeFraction(band, 'a', 'start')).toBeGreaterThanOrEqual(0)
    expect(edgeFraction(band, 'd', 'end')).toBeLessThanOrEqual(1)
  })
  test('a continuous x ignores `at`', () => {
    const line = xScaleFor([0, 5, 10], false)
    expect(edgeFraction(line, 5, 'start')).toBe(line.fraction(5))
  })
  test('an unknown key has no fraction', () => {
    expect(edgeFraction(band, 'z', 'start')).toBeNull()
  })
})

type Row = { d: number; v: number }
const rows: Row[] = [...Array.from({ length: 31 }, (_, i) => 10 + i), 2400].map((v, d) => ({
  d,
  v,
}))
const dot: ChartSeries<Row> = {
  key: 'v',
  label: 'V',
  color: 'red',
  getValue: (r) => r.v,
  mark: 'dot',
}

describe('y domain through the adapter', () => {
  const props = (y: NonNullable<CartesianChartProps<Row>['y']>): CartesianChartProps<Row> => ({
    label: 'x',
    data: rows,
    x: { value: (r) => r.d },
    y,
    series: [{ mark: 'dot', key: 'v', label: 'V', color, y: (r) => r.v } satisfies Series<Row>],
  })
  test("a tuple stays a tuple; the object and function forms are the seam's", () => {
    expect(toEngineSpec(props({ domain: [0, 80] })).y).toEqual({ domain: [0, 80] })
    expect(toEngineSpec(props({ domain: { floor: 0, ceil: 120 } })).y).toBeUndefined()
    expect(toEngineSpec(props({ domain: ([lo, hi]) => [lo, hi] })).y).toBeUndefined()
  })
})

describe('off-scale', () => {
  test('a value past the domain names its edge; a value inside names none', () => {
    expect(offScaleSide(2400, [0, 120])).toBe('top')
    expect(offScaleSide(-3, [0, 120])).toBe('bottom')
    expect(offScaleSide(60, [0, 120])).toBeNull()
    expect(offScaleSide(Number.NaN, [0, 120])).toBeNull()
    expect(clampToDomain(2400, [0, 120])).toBe(120)
    expect(clampToDomain(-3, [0, 120])).toBe(0)
  })

  let seen: PlotContext<Row, number> | undefined
  const compile = (y?: { domain?: [number, number] }) =>
    compileCartesian({
      chartId: 'off',
      data: rows,
      x: (r) => r.d,
      series: [dot],
      marks: (plot) => {
        seen = plot
        return []
      },
      ...(y && { y }),
    })
  const build = (def: ReturnType<typeof compile>) =>
    def.chart({ width: 390, height: 240, defaultTheme: {} as never })

  test('the datum is drawn on the plot edge, the tooltip source stays the true value', () => {
    const def = compile({ domain: [0, 120] })
    build(def)
    const ys = (seen as PlotContext<Row, number>).rows('v').map((r) => r.y)
    expect(Math.max(...(ys as number[]))).toBe(120)
    expect(dot.getValue(rows.at(-1) as Row)).toBe(2400)
  })

  test('one caret per datum past the top, none on an unbounded chart', () => {
    const marks = (bounded: boolean) =>
      offScaleMarks({
        series: [dot],
        data: rows,
        x: (r) => r.d,
        fraction: (x) => x / 40,
        domainOf: () => (bounded ? [0, 120] : null),
        yScaleOf: () => 'y',
        formatOf: () => (v) => String(v),
        labels: { frame: () => ({ width: 0, height: 0 }), obstacles: () => [] },
      })
    expect(marks(true)).toHaveLength(1)
    expect(marks(false)).toHaveLength(0)
  })

  test('a reversed tuple clamps and names its ends by value', () => {
    expect(clampToDomain(2400, [120, 0])).toBe(120)
    expect(clampToDomain(50, [120, 0])).toBe(50)
    expect(offScaleSide(50, [120, 0])).toBeNull()
    expect(offScaleSide(2400, [120, 0])).toBe('top')
  })

  const barA: ChartSeries<Row> = { ...dot, mark: 'bar' }
  const barB: ChartSeries<Row> = { ...dot, key: 'w', mark: 'bar' }
  test('a lone bar series in the default stacked layout still clamps', () => {
    compileCartesian({
      chartId: 'off-lone',
      data: rows,
      x: (r) => r.d,
      series: [barA],
      stack: 'stacked',
      y: { domain: [0, 120] },
      marks: (plot) => {
        seen = plot
        return []
      },
    }).chart({ width: 390, height: 240, defaultTheme: {} as never })
    const ys = (seen as PlotContext<Row, number>).rows('v').map((r) => r.y)
    expect(Math.max(...(ys as number[]))).toBe(120)
  })

  test('a stack of bars, or a normalized one, keeps the raw values: no clamp, no caret', () => {
    for (const [stack, series] of [
      ['stacked', [barA, barB]],
      ['normalized', [dot]],
    ] as const) {
      const def = compileCartesian({
        chartId: 'off-stack',
        data: rows,
        x: (r) => r.d,
        series,
        stack,
        y: { domain: [0, 120] },
        marks: (plot) => {
          seen = plot
          return []
        },
      })
      const spec = build(def)
      const ys = (seen as PlotContext<Row, number>).rows('v').map((r) => r.y)
      expect(Math.max(...(ys as number[]))).toBe(2400)
      expect(JSON.stringify(spec.marks)).not.toContain('off-scale')
    }
  })

  test('the compiled chart carries the caret, its value label and the zx scale they draw on', () => {
    const spec = build(compile({ domain: [0, 120] }))
    expect(JSON.stringify(Object.keys(spec.scales))).toContain('zx')
    expect(spec.marks.length - build(compile()).marks.length).toBe(2)
  })
})

describe('y format', () => {
  test('the consumer format writes the tick labels', () => {
    const def = compileCartesian({
      chartId: 'fmt',
      data: [0, 1, 2, 3].map((d) => ({ d, v: d * 0.5 })),
      x: (r: Row) => r.d,
      series: [dot],
      marks: () => [],
      y: { format: (v: number) => v.toFixed(1).replace('.', ',') },
    })
    const spec = def.chart({ width: 800, height: 240, defaultTheme: {} as never })
    const { ticks } = (
      spec.scales['y'] as unknown as {
        axis: { ticks: { values?: number[]; count?: number; format: (v: number) => string } }
      }
    ).axis
    expect(ticks.format(2.5)).toBe('2,5')
  })
})
