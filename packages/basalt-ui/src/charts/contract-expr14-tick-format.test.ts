/** `x.tickFormat` writes the ticks while `x.format` keeps the readout (expression cycle 14, n66 .29). */
import { describe, expect, test } from 'bun:test'
import { compileCartesian } from './core/compile'
import { toEngineSpec } from './parts/cartesian-adapt'
import type { CartesianChartProps } from './contract'
import type { ChartSeries } from './types'

type Row = { t: Date; v: number }
type Axis = { axis: { ticks: { values: Date[]; format: (d: Date) => string } } }
const HOUR = 3_600_000
const START = Date.UTC(2026, 10, 12)
const data: Row[] = Array.from({ length: 49 }, (_, i) => ({ t: new Date(START + i * HOUR), v: i }))
const v: ChartSeries<Row> = {
  key: 'v',
  label: 'V',
  color: 'var(--basalt-line)',
  getValue: (d) => d.v,
}

function tickLabels(opts: {
  formatX?: (d: Date) => string
  formatXTick?: (d: Date) => string
}): string[] {
  const spec = compileCartesian({
    chartId: 'tick-format',
    data,
    x: (d) => d.t,
    series: [v],
    marks: () => [],
    ...opts,
  }).chart({ width: 800, height: 240, defaultTheme: {} as never })
  const { values, format } = (spec.scales['x'] as unknown as Axis).axis.ticks
  return values.map((t) => format(t))
}

describe('x.tickFormat', () => {
  test('writes the tick labels while format keeps the readout', () => {
    const out = tickLabels({ formatX: () => 'readout', formatXTick: (d) => `t${d.getUTCHours()}` })
    expect(out.length).toBeGreaterThan(1)
    expect(out.every((l) => /^t\d+$/.test(l))).toBe(true)
  })

  test('without it the ticks still follow format', () => {
    expect(tickLabels({ formatX: () => 'readout' }).every((l) => l === 'readout')).toBe(true)
  })

  test('the chart props carry it to the engine spec apart from format', () => {
    const format = (): string => 'readout'
    const tickFormat = (): string => 'tick'
    const spec = toEngineSpec({
      label: 'Load',
      data,
      x: { value: (d: Row) => d.t, format, tickFormat },
      series: [],
    } as unknown as CartesianChartProps<Row>)
    expect(spec.formatX).toBe(format)
    expect(spec.formatXTick).toBe(tickFormat)
  })
})
