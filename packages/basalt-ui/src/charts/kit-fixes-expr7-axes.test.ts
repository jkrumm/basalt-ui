/**
 * Expression cycle 7 (`v3-expr-7-kit-fixes` 6): a time axis keeps its labels apart, a long band label
 * neither crowds its neighbours nor shrinks the plot, and a y axis that draws a zone puts ticks on
 * the zone's edges.
 */
import { describe, expect, test } from 'bun:test'
import type { ChartSeries } from '../types'
import { compileCartesian, xGuide } from './core/compile'
import { xScaleFor } from './core/scales'

const DAY = 86_400_000

type Row = { t: Date; v: number }
const line: ChartSeries<Row> = {
  key: 'v',
  label: 'V',
  color: 'var(--basalt-line)',
  mark: 'line',
  getValue: (d) => d.v,
}
const days: Row[] = Array.from({ length: 28 }, (_, i) => ({
  t: new Date(Date.UTC(2026, 8, 27) + i * DAY),
  v: (i % 7) - 3,
}))

type Scales = {
  x: { axis: { tickLabels: { thin: { minGap: number } } } }
  y: { axis: { ticks: { values?: number[] } } }
}
const scalesOf = (extra: object, width = 700): Scales =>
  compileCartesian<Row, Date>({
    chartId: 'expr7-axes',
    locale: 'en',
    data: days,
    x: (d) => d.t,
    series: [line],
    marks: () => [],
    ...extra,
  }).chart({ width, height: 300, defaultTheme: {} as never }).scales as unknown as Scales

describe('x tick labels keep their air', () => {
  test('a time axis asks the engine for 12 px between two labels, at 390 as at 1800', () => {
    for (const width of [390, 1800])
      expect(scalesOf({}, width).x.axis.tickLabels.thin.minGap).toBe(12)
  })
})

describe('y ticks on the edges of a zone', () => {
  const zone = { from: -4, to: 4, fill: 'var(--basalt-ink)', axisSide: 'left' as const }
  const ticks = (extra: object, domain: [number, number] = [-10, 10]): number[] =>
    scalesOf({ y: { domain }, ...extra }).y.axis.ticks.values ?? []

  test('the zone edges are ticks and the round ticks beside them give way', () => {
    const values = ticks({ zones: [zone] })
    expect(values).toContain(-4)
    expect(values).toContain(4)
    expect(values).not.toContain(-5)
    expect(values).not.toContain(5)
    expect(values).toContain(0)
    expect(values).toContain(-10)
  })

  test('without a zone the ticks are the engine round ones', () => {
    expect(scalesOf({ y: { domain: [-10, 10] } }).y.axis.ticks.values).toBeUndefined()
  })

  test('an edge on the domain end, or past it, adds nothing', () => {
    expect(ticks({ zones: [{ ...zone, from: -10, to: Number.POSITIVE_INFINITY }] })).toEqual([])
  })

  test('a tick list the page wrote is its own', () => {
    expect(ticks({ zones: [zone], y: { domain: [-10, 10], ticks: [-10, -5, 0, 5, 10] } })).toEqual([
      -10, -5, 0, 5, 10,
    ])
  })
})

describe('a long band label', () => {
  const names = ['Mon', 'Tue', 'Wed', 'customer-support-triage-assistant-v2']
  const model = xScaleFor(names, true)
  const guide = (width: number | undefined) =>
    xGuide({ model, xTicks: undefined, cls: 'narrow', width }) as unknown as {
      axis: {
        ticks: { format: (v: string) => string }
        tickLabels: { anchor: (c: { value: string }) => string | undefined }
      }
    }

  test('is cut with an ellipsis at a third of the plot, and whole when the width allows it', () => {
    const narrow = guide(390).axis.ticks.format
    expect(narrow(names[3] as string).endsWith('…')).toBe(true)
    expect(narrow(names[3] as string).length).toBeLessThan((names[3] as string).length)
    expect(narrow('Mon')).toBe('Mon')
    expect(guide(1800).axis.ticks.format(names[3] as string)).toBe(names[3] as string)
    expect(guide(undefined).axis.ticks.format(names[3] as string)).toBe(names[3] as string)
  })

  test('anchors to the plot edge, so it cannot hang over it and shrink the plot', () => {
    const anchor = guide(390).axis.tickLabels.anchor
    expect(anchor({ value: names[3] as string })).toBe('end')
    expect(anchor({ value: 'Wed' })).toBeUndefined()
  })
})
