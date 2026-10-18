/**
 * Wave 37 chart chrome: the tooltip header (date only on a day-granular series, in the page's
 * locale), the y gutter, ticks and the legend on one type step, the y ticks covering the data,
 * `RefLine.labelPosition`, `StackedArea` band opacity, the `Lines` defaults (a linear curve, one
 * naming switch, no legend for a lone series) and the tooltip's unit.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import type { ChartPoint, StoredChartSpec } from '@tanstack/charts/types/core'
import { scaleLinear } from 'd3-scale'
import { renderToString } from 'react-dom/server'
import { defineFormat } from '../format'
import { resetFormatDefaults } from '../format/shared'
import { VX } from '../tokens'
import { Bars } from './Bars'
import { Lines } from './Lines'
import { StackedArea } from './StackedArea'
import { compileCartesian } from './compile'
import { endLabelPlan } from './labels'
import type { ChartSeries, PlotContext, PlotRow, RefLine } from './types'

afterEach(resetFormatDefaults)

const ssr = (node: React.ReactNode): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(node)
  return el
}

type Row = { t: Date; a: number; b?: number }
const A: ChartSeries<Row> = {
  key: 'a',
  label: 'Alpha',
  color: 'var(--vx-line)',
  getValue: (d) => d.a,
}
const B: ChartSeries<Row> = {
  key: 'b',
  label: 'Beta',
  color: 'var(--vx-accent)',
  getValue: (d) => d.b ?? null,
}
const dayAt = (d: number, hour = 0): Date => new Date(Date.UTC(2026, 9, d, hour))
const daily = (hour = 0): Row[] =>
  [1, 2, 3, 4, 5].map((d) => ({ t: dayAt(d, hour), a: d * 100, b: d * 50 }))
const x = (d: Row): Date => d.t

function titleOf(data: Row[], at: number): string | undefined {
  const def = compileCartesian({ chartId: 't', data, x, series: [A], marks: () => [] })
  const tooltip = def.tooltip
  if (!tooltip || !('content' in tooltip) || !tooltip.content) throw new Error('no tooltip')
  const datum = data[at]
  const content = tooltip.content(
    [{ datum: { x: datum?.t, y: 0, series: 'a', datum }, xValue: datum?.t } as ChartPoint],
    {} as never,
  )
  return content.title
}

const fmt = (locale: string, at: Date, time = false): string =>
  new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
    ...(time && { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const }),
  }).format(at)

describe('tooltip header', () => {
  test('a daily bucket at 22:00 UTC (a local midnight east of UTC) reads as its date only', () => {
    defineFormat({ locale: 'en-GB' })
    // Oct 16 00:00 in UTC+2 is Oct 15 22:00 UTC: the bucket is Oct 16.
    const title = titleOf(daily(22), 0)
    expect(title).not.toContain('22:00')
    expect(title).toBe(fmt('en-GB', dayAt(2)))
  })

  test('a UTC-midnight daily bucket is its date only', () => {
    defineFormat({ locale: 'en-GB' })
    expect(titleOf(daily(), 1)).toBe(fmt('en-GB', dayAt(2)))
  })

  test('the header follows the page locale: day before month in en-GB, month first in en-US', () => {
    defineFormat({ locale: 'en-GB' })
    expect(titleOf(daily(), 1)).toMatch(/2\s+Oct/)
    defineFormat({ locale: 'en-US' })
    expect(titleOf(daily(), 1)).toMatch(/Oct\s+2/)
  })

  test('hourly data keeps the time of day, in the same locale', () => {
    defineFormat({ locale: 'en-GB' })
    const hourly: Row[] = [0, 1, 2, 3].map((h) => ({ t: dayAt(1, 14 + h), a: h, b: h }))
    const title = titleOf(hourly, 1)
    expect(title).toContain('15:00')
    expect(title).toMatch(/1\s+Oct/)
  })
})

describe('y gutter and one type step', () => {
  const at = (width: number, height: number): StoredChartSpec =>
    compileCartesian({ chartId: 'g', data: daily(), x, series: [A], marks: () => [] }).chart({
      width,
      height,
      defaultTheme: {} as never,
    })

  test('a short compact chart still has its y labels in a gutter, never inside the plot', () => {
    for (const height of [120, 179, 180, 280]) {
      const spec = at(360, height)
      const axis = spec.scales['y']?.axis
      if (!axis || typeof axis !== 'object' || typeof axis.tickLabels !== 'object')
        throw new Error('no y axis')
      expect(axis.tickLabels.anchor).toBeUndefined()
      expect(axis.tickLabels.dx).toBeUndefined()
      expect(spec.margin).toBeUndefined()
    }
  })

  test('the legend is set in the tick step (one size for ticks and legend)', () => {
    const el = ssr(<Lines ariaLabel="L" data={daily()} x={x} series={[A, B]} />)
    const legend = el.querySelector('[data-basalt-chart-legend]') as HTMLElement | null
    expect(legend).not.toBeNull()
    expect(legend?.style.fontSize).toBe(`${VX.text.micro}px`)
  })

  test('a bar legend swatch is one shape (rounded square) at every width', () => {
    const el = ssr(<Bars ariaLabel="B" data={daily()} x={x} bars={[A, B]} />)
    const swatches = [...el.querySelectorAll('[data-legend-key="a"] > [aria-hidden]')].map(
      (s) => s as HTMLElement,
    )
    expect(swatches.length).toBeGreaterThanOrEqual(2)
    for (const s of swatches) expect(s.style.borderRadius).not.toBe('50%')
  })
})

describe('y ticks cover the data', () => {
  const small: Row[] = [1, 2, 3, 4, 5, 6, 7].map((d, i) => ({
    t: dayAt(d),
    a: [1, 2, 5, 3, 4, 2, 1][i] as number,
  }))
  for (const [width, height] of [
    [390, 280],
    [640, 320],
    [960, 384],
  ] as const) {
    test(`${width}px: the top tick is at least the series maximum`, () => {
      const spec = compileCartesian({
        chartId: 'c',
        data: small,
        x,
        series: [A],
        marks: () => [],
      }).chart({ width, height, defaultTheme: {} as never })
      const y = spec.scales['y']
      const axis = y?.axis
      if (!axis || typeof axis !== 'object' || !axis.ticks || !('count' in axis.ticks))
        throw new Error('no counted y ticks')
      const scale = y?.scale as unknown as { domain: () => [number, number] }
      const domain = scale.domain()
      const ticks = scaleLinear()
        .domain(domain)
        .ticks(axis.ticks.count as number)
      expect(ticks.at(-1) as number).toBeGreaterThanOrEqual(5)
    })
  }

  test('a fixed domain is left alone', () => {
    const spec = compileCartesian({
      chartId: 'c',
      data: small,
      x,
      series: [A],
      y: { domain: [0, 5.5] },
      marks: () => [],
    }).chart({ width: 390, height: 280, defaultTheme: {} as never })
    const scale = spec.scales['y']?.scale as unknown as { domain: () => [number, number] }
    expect(scale.domain()).toEqual([0, 5.5])
  })
})

describe('RefLine.labelPosition', () => {
  const data: Row[] = [1, 2, 3, 4].map((d) => ({ t: dayAt(d), a: d * 100 }))
  const ref = (over: Partial<RefLine> = {}): RefLine => ({
    value: 250,
    color: 'var(--vx-good-ref)',
    label: 'Goal',
    ...over,
  })
  const label = (r: RefLine, extra: object = {}): { y: number; line: number; anchor: string } => {
    const el = ssr(
      <Lines
        ariaLabel="L"
        data={data}
        x={x}
        series={[A]}
        y={{ domain: [0, 500] }}
        refLines={[r]}
        {...extra}
      />,
    )
    const text = el.querySelector('g[data-ts-key="ref-0-label"] text')
    const line = el.querySelector('g[data-ts-key="ref-0"] line')
    return {
      y: Number(text?.getAttribute('y')),
      line: Number(line?.getAttribute('y1')),
      anchor: text?.getAttribute('text-anchor') ?? '',
    }
  }

  test("'end-above' sits above the line at the plot's end", () => {
    const l = label(ref({ labelPosition: 'end-above' }))
    expect(l.y).toBeLessThan(l.line)
    expect(l.anchor).toBe('end')
  })
  test("'end-below' sits below the line at the plot's end", () => {
    const l = label(ref({ labelPosition: 'end-below' }))
    expect(l.y).toBeGreaterThan(l.line)
    expect(l.anchor).toBe('end')
  })
  test("'start-above' starts at the plot's left edge, above the line", () => {
    const l = label(ref({ labelPosition: 'start-above' }))
    expect(l.y).toBeLessThan(l.line)
    expect(l.anchor).toBe('start')
  })
  test('the default avoids the data: a line the series ends on moves its label to the start', () => {
    // The series reaches 400 at the right end: a label at the end, above or below the 390 line,
    // sits on it. The left edge (the series is at 100 there) is clear.
    const l = label(ref({ value: 390 }))
    expect(l.anchor).toBe('start')
  })
  test('the default stays at the end above the line when nothing runs through it', () => {
    const l = label(ref({ value: 50 }))
    expect(l.anchor).toBe('end')
    expect(l.y).toBeLessThan(l.line)
  })
})

describe('StackedArea band opacity', () => {
  const bands = [A, B]
  const fills = (el: HTMLElement): string[] =>
    [...el.querySelectorAll('g[data-ts-key="bands"] path')].map((p) => p.getAttribute('fill') ?? '')
  test('a chart-level fillOpacity sets every band (default 85%)', () => {
    const base = fills(ssr(<StackedArea ariaLabel="S" data={daily()} x={x} series={bands} />))
    expect(base.join()).toContain('85%')
    const soft = fills(
      ssr(<StackedArea ariaLabel="S" data={daily()} x={x} series={bands} fillOpacity={0.6} />),
    )
    expect(soft.join()).toContain('60%')
    expect(soft.join()).not.toContain('85%')
  })
  test('a band keeps its own fillOpacity over the chart-level one', () => {
    const mixed = fills(
      ssr(
        <StackedArea
          ariaLabel="S"
          data={daily()}
          x={x}
          fillOpacity={0.6}
          series={[{ ...A, fillOpacity: 0.4 }, B]}
        />,
      ),
    )
    expect(mixed.join()).toContain('40%')
    expect(mixed.join()).toContain('60%')
  })
})

describe('Lines defaults', () => {
  const path = (el: HTMLElement): string =>
    el.querySelector('g.ts-chart__line[data-ts-key^="a:"] path')?.getAttribute('d') ?? ''
  const zigzag: Row[] = [1, 2, 3, 4, 5].map((d, i) => ({
    t: dayAt(d),
    a: [3, 9, 2, 8, 1][i] as number,
  }))

  test('the default curve is linear: straight segments, no Bézier', () => {
    const d = path(ssr(<Lines ariaLabel="L" data={zigzag} x={x} series={[A]} />))
    expect(d).toContain('L')
    expect(d).not.toContain('C')
  })
  test("curve: 'monotone' stays an explicit opt-in", () => {
    const d = path(
      ssr(
        <Lines ariaLabel="L" data={zigzag} x={x} series={[{ ...A, curve: 'monotone' as const }]} />,
      ),
    )
    expect(d).toContain('C')
  })

  test('a single-series chart draws no legend by default; an explicit legend still does', () => {
    expect(
      ssr(<Lines ariaLabel="L" data={zigzag} x={x} series={[A]} />).querySelector(
        '[data-basalt-chart-legend]',
      ),
    ).toBeNull()
    expect(
      ssr(<Lines ariaLabel="L" data={zigzag} x={x} series={[A]} legend={{}} />).querySelector(
        '[data-basalt-chart-legend]',
      ),
    ).not.toBeNull()
    expect(
      ssr(<Lines ariaLabel="L" data={daily()} x={x} series={[A, B]} />).querySelector(
        '[data-basalt-chart-legend]',
      ),
    ).not.toBeNull()
  })
})

describe('Lines naming', () => {
  const legendOf = (el: HTMLElement): HTMLElement | null =>
    el.querySelector('[data-basalt-chart-legend]')
  const two = <Lines ariaLabel="L" data={daily()} x={x} series={[A, B]} />

  test('auto: the legend is hidden from the wide class, where the end labels name the lines', () => {
    expect(legendOf(ssr(two))?.hasAttribute('data-hide-wide')).toBe(true)
  })
  test('auto: more than three series keep the legend at every width (no end labels)', () => {
    const many = [A, B, { ...A, key: 'c' }, { ...A, key: 'd' }]
    expect(
      legendOf(ssr(<Lines ariaLabel="L" data={daily()} x={x} series={many} />))?.hasAttribute(
        'data-hide-wide',
      ),
    ).toBe(false)
  })
  test('auto: a legend-named reference line keeps the legend (it names more than the series)', () => {
    const el = ssr(
      <Lines
        ariaLabel="L"
        data={daily()}
        x={x}
        series={[A, B]}
        refLines={[{ value: 100, color: 'var(--vx-good-ref)', legend: { label: 'Goal' } }]}
      />,
    )
    expect(legendOf(el)?.hasAttribute('data-hide-wide')).toBe(false)
  })
  test("'legend': the legend at every width, no end labels", () => {
    const el = ssr(<Lines ariaLabel="L" data={daily()} x={x} series={[A, B]} naming="legend" />)
    expect(legendOf(el)?.hasAttribute('data-hide-wide')).toBe(false)
  })
  test("'endLabels': no legend at any width", () => {
    const el = ssr(<Lines ariaLabel="L" data={daily()} x={x} series={[A, B]} naming="endLabels" />)
    expect(legendOf(el)).toBeNull()
  })

  const plot = (over: Partial<PlotContext<Row, Date>> = {}): PlotContext<Row, Date> => {
    const rows = daily()
    const of = (s: ChartSeries<Row>): PlotRow<Row, Date>[] =>
      rows.map((datum) => ({ x: datum.t, y: s.getValue(datum), series: s.key, datum }))
    return {
      rows: (key) => of(key === 'a' ? A : B),
      visible: [A, B],
      highlighted: null,
      containerClass: 'regular',
      width: 640,
      height: 300,
      plotWidth: 600,
      plotHeight: 300,
      data: rows,
      xFraction: (v) => (+v - +dayAt(1)) / (+dayAt(5) - +dayAt(1)),
      y2: undefined,
      yDomain: [0, 500],
      y2Domain: undefined,
      ...over,
    }
  }
  test("'endLabels' draws end labels below the wide class too", () => {
    expect(endLabelPlan(plot(), [A, B], 'endLabels')).toHaveLength(2)
    expect(endLabelPlan(plot(), [A, B], 'auto')).toHaveLength(0)
    expect(endLabelPlan(plot({ containerClass: 'wide' }), [A, B], 'auto')).toHaveLength(2)
    expect(endLabelPlan(plot({ containerClass: 'wide' }), [A, B], 'legend')).toHaveLength(0)
  })
  test('two end labels that would collide are nudged apart, never dropped', () => {
    const close: Row[] = [1, 2].map((d) => ({ t: dayAt(d), a: 200, b: 202 }))
    const rows = (s: ChartSeries<Row>): PlotRow<Row, Date>[] =>
      close.map((datum) => ({ x: datum.t, y: s.getValue(datum), series: s.key, datum }))
    const plan = endLabelPlan(
      plot({
        containerClass: 'wide',
        rows: (key) => rows(key === 'a' ? A : B),
        xFraction: (v) => (+v - +dayAt(1)) / (+dayAt(2) - +dayAt(1)),
      }),
      [A, B],
      'auto',
    )
    expect(plan).toHaveLength(2)
    const shifts = plan.map((p) => p.nudge)
    expect(Math.abs((shifts[0] ?? 0) - (shifts[1] ?? 0))).toBeGreaterThanOrEqual(13 - 1.3)
  })
})

describe('tooltip', () => {
  const rowsOf = (series: ChartSeries<Row>[], formatValue?: (v: number) => string) => {
    const data = daily()
    const def = compileCartesian({
      chartId: 'u',
      data,
      x,
      series: series.map((s) => ({ ...s, ...(formatValue && { formatValue }) })),
      marks: () => [],
    })
    const tooltip = def.tooltip
    if (!tooltip || !('content' in tooltip) || !tooltip.content) throw new Error('no tooltip')
    const datum = data[1]
    return tooltip.content(
      [{ datum: { x: datum?.t, y: 0, series: 'a', datum }, xValue: datum?.t } as ChartPoint],
      {} as never,
    ).rows
  }
  const sessions: ChartSeries<Row> = { ...A, label: 'Sessions' }

  test("a lone series' row names its unit once (no 'Sessions 27 sessions')", () => {
    const [row] = rowsOf([sessions], (v) => `${v} sessions`)
    expect(row?.label).toBe('Sessions')
    expect(row?.value).toBe('200')
  })
  test('a unit that is not the series name keeps both', () => {
    const [row] = rowsOf([sessions], (v) => `${v} min`)
    expect(row?.label).toBe('Sessions')
    expect(row?.value).toBe('200 min')
  })
  test('several series keep every label', () => {
    const rows = rowsOf([sessions, { ...B, label: 'Runs' }], (v) => `${v} sessions`)
    expect(rows.map((r) => r.label)).toEqual(['Sessions', 'Runs'])
  })
})

describe('Bars hover', () => {
  test('a bar chart paints no crosshair rule (line-chart chrome)', () => {
    const def = compileCartesian({
      chartId: 'b',
      data: daily(),
      x,
      series: [A],
      marks: () => [],
      crosshair: false,
    })
    const withRule = compileCartesian({
      chartId: 'b',
      data: daily(),
      x,
      series: [A],
      marks: () => [],
    })
    const build = (d: typeof def): StoredChartSpec =>
      d.chart({ width: 640, height: 240, defaultTheme: {} as never })
    expect(build(def).marks.length).toBe(build(withRule).marks.length - 1)
  })
})
