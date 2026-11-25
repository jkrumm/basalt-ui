/**
 * The data behind the rich tooltip, the ramp line, events, the waterfall and the window: pure functions, read without a browser. The painted result is in
 * `tests/layout/charts-gallery.layout.test.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { withLogY2 } from './axis-gaps'
import { compileCartesian, eventsByDatum, rampGradient } from './core/compile'
import { changeOf, isRich, rampColor, rampShare } from './core/rich-tooltip'
import { CV } from './core/theme'
import { chartWindow } from './parts/range-navigator'
import { waterfallSteps } from './parts/waterfall'
import type { ChartSeries } from './types'

const day = (i: number): Date => new Date(Date.UTC(2026, 0, 1 + i))

describe('changeOf', () => {
  test('a signed percent with a minus sign, and its direction', () => {
    expect(changeOf(112.4, 100)).toEqual({ text: '+12.4%', direction: 'up' })
    expect(changeOf(97, 100)).toEqual({ text: '\u22123.0%', direction: 'down' })
    expect(changeOf(100, 100)).toEqual({ text: '0.0%', direction: 'flat' })
  })

  test('past tenfold the change reads as a multiple', () => {
    expect(changeOf(46_400, 10)).toEqual({ text: '\u00D74,640', direction: 'up' })
  })

  test('a zero or non-finite base has no change', () => {
    expect(changeOf(5, 0)).toBeUndefined()
    expect(changeOf(5, Number.NaN)).toBeUndefined()
  })
})

describe('rampColor', () => {
  test('the ends and the middle are the status tones; bad-good reverses them', () => {
    expect(rampColor(0)).toBe(CV.good)
    expect(rampColor(0.5)).toBe(CV.warn)
    expect(rampColor(1)).toBe(CV.bad)
    expect(rampColor(0, 'bad-good')).toBe(CV.bad)
    expect(rampColor(-3)).toBe(CV.good)
    expect(rampColor(7)).toBe(CV.bad)
  })

  test('a step between mixes its two neighbours', () => {
    expect(rampColor(0.25)).toContain(`${CV.warn} 50%`)
    expect(rampColor(0.75)).toContain(`${CV.bad} 50%`)
  })

  test('rampShare places a reading on its domain', () => {
    expect(rampShare(25, [0, 100])).toBe(0.25)
    expect(rampShare(5, [5, 5])).toBe(0)
  })
})

type Row = { t: Date; price: number; score: number | null }
const rows: Row[] = [0, 1, 2, 3, 4].map((i) => ({ t: day(i), price: 10 * (i + 1), score: i * 25 }))
const priceSeries: ChartSeries<Row> = {
  key: 'price',
  label: 'Price',
  color: 'var(--basalt-chart-1)',
  getValue: (d) => d.price,
  colorBy: { value: (d) => d.score, domain: [0, 100], label: 'Score', ramp: 'good-bad' },
}

describe('rampGradient', () => {
  const fraction = (x: Date): number => (x.getTime() - day(0).getTime()) / (4 * 86_400_000)

  test('a horizontal gradient, one stop per ramp step, offsets across the line', () => {
    const g = rampGradient(priceSeries, 1, { data: rows, x: (d) => d.t }, { fraction })
    expect(g).not.toBeNull()
    expect(g?.id).toBe('basalt-ramp-1')
    expect([g?.x1, g?.x2, g?.y1, g?.y2]).toEqual([0, 1, 0, 0])
    expect(g?.stops.map((s) => s.offset)).toEqual([0, 0.25, 0.5, 0.75, 1])
    expect(g?.stops[0]?.color).toBe(CV.good)
    expect(g?.stops.at(-1)?.color).toBe(CV.bad)
  })

  test('a run of one color keeps only its two ends', () => {
    const flat = rows.map((r) => ({ ...r, score: 0 }))
    const g = rampGradient(priceSeries, 0, { data: flat, x: (d) => d.t }, { fraction })
    expect(g?.stops.map((s) => s.offset)).toEqual([0, 1])
  })

  test('a missing reading takes the series color', () => {
    const gap = rows.map((r, i) => ({ ...r, score: i === 2 ? null : r.score }))
    const g = rampGradient(priceSeries, 0, { data: gap, x: (d) => d.t }, { fraction })
    expect(g?.stops.find((s) => s.offset === 0.5)?.color).toBe('var(--basalt-chart-1)')
  })
})

describe('eventsByDatum', () => {
  test('an event lands on the datum nearest it, one past the data names none', () => {
    const map = eventsByDatum({
      data: rows,
      x: (d: Row) => d.t,
      events: [
        { at: new Date(day(2).getTime() + 3_600_000), label: 'Halving' },
        { at: day(40), label: 'Later' },
      ],
    })
    expect(map.size).toBe(1)
    expect(map.get(rows[2] as Row)?.[0]?.label).toBe('Halving')
  })
})

describe('compileCartesian', () => {
  const base = {
    data: rows,
    x: (d: Row) => d.t,
    chartId: 'test',
    marks: () => [],
    series: [
      {
        key: 'score',
        label: 'Score',
        color: 'var(--basalt-chart-2)',
        getValue: (d: Row) => d.score,
      },
      { ...priceSeries, axis: 'right' as const },
    ],
    y2: { scale: 'log' as const },
  }

  test('a colorBy series, an event or a change marks the definition rich', () => {
    expect(isRich(compileCartesian<Row, Date>(base))).toBe(true)
    const plain = compileCartesian<Row, Date>({
      ...base,
      series: [base.series[0] as ChartSeries<Row>],
    })
    expect(isRich(plain)).toBe(false)
    expect(isRich(compileCartesian<Row, Date>({ ...base, tooltip: false }))).toBe(false)
  })
})

describe('withLogY2', () => {
  type LogInput = {
    data: readonly Row[]
    series: readonly {
      key: string
      mark?: string
      axis?: 'left' | 'right'
      getValue: (d: Row) => number | null
    }[]
    y2: { scale: 'linear' | 'log' }
  }
  const logY2 = (input: LogInput): LogInput => withLogY2<Row, LogInput>(input)
  const series: LogInput['series'] = [
    { key: 'a', getValue: (d: Row) => d.price },
    { key: 'b', axis: 'right' as const, mark: 'bar', getValue: (d: Row) => d.price },
  ]

  test('a right-axis bar refuses a log y2 in a dev build', () => {
    expect(() => logY2({ data: rows, series, y2: { scale: 'log' } })).toThrow(
      /right-axis series "b"/,
    )
  })

  test('a right-axis value of zero throws in a dev build', () => {
    const zero: LogInput['series'] = [{ key: 'p', axis: 'right', getValue: () => 0 }]
    expect(() => logY2({ data: rows, series: zero, y2: { scale: 'log' } })).toThrow(/log y2/)
  })

  test('a linear y2 passes through', () => {
    const input: LogInput = { data: rows, series, y2: { scale: 'linear' } }
    expect(logY2(input)).toBe(input)
  })
})

describe('waterfallSteps', () => {
  test('steps float on the running total; an opening and a closing bar stand on zero', () => {
    const steps = waterfallSteps({
      data: [
        { name: 'A', v: 30 },
        { name: 'B', v: -10 },
        { name: 'C', v: null },
      ],
      step: (d) => d.name,
      value: (d) => d.v,
      start: { label: 'Open', value: 100 },
      total: 'Close',
    })
    expect(steps.map((s) => [s.step, s.start, s.end, s.kind])).toEqual([
      ['Open', 0, 100, 'total'],
      ['A', 100, 130, 'increase'],
      ['B', 130, 120, 'decrease'],
      ['Close', 0, 120, 'total'],
    ])
  })
})

describe('chartWindow', () => {
  const daily = Array.from({ length: 400 }, (_, i) => ({ t: day(i) }))
  const spans = { '1m': 30, all: 'all' } as const

  test('a preset is a span back from the last datum, with one row beyond each end', () => {
    const view = chartWindow<{ t: Date }, '1m' | 'all'>(daily, (d) => d.t, { preset: '1m' }, spans)
    expect(view.domain).toEqual([day(369), day(399)])
    expect(view.data[0]?.t).toEqual(day(368))
    expect(view.data.at(-1)?.t).toEqual(day(399))
  })

  test('all is the whole history', () => {
    expect(
      chartWindow<{ t: Date }, '1m' | 'all'>(daily, (d) => d.t, { preset: 'all' }, spans).domain,
    ).toEqual([day(0), day(399)])
  })

  test('a custom value is its two days, clamped to the data', () => {
    const view = chartWindow<{ t: Date }, '1m' | 'all'>(
      daily,
      (d) => d.t,
      { preset: 'custom', from: '2025-12-01', to: '2026-01-11' },
      spans,
    )
    expect(view.domain).toEqual([day(0), day(10)])
  })

  test('no data is no window', () => {
    expect(chartWindow([], (d: { t: Date }) => d.t, { preset: 'all' }, spans).data).toEqual([])
  })
})
