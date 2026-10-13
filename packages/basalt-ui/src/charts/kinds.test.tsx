/**
 * `Lines`, `Bars` and `ChartCard` behaviour through their public props: what the compiled
 * definition and the rendered DOM say, never the engine's internals.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import type { ChartPoint, StoredChartSpec } from '@tanstack/charts/types/core'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { Bars } from './Bars'
import { ChartCard } from './ChartCard'
import { compileCartesian } from './compile'
import { Lines } from './Lines'
import type { ChartSeries } from './types'

type Row = { t: Date; a: number | null; b: number; c: number }
const day = (d: number): Date => new Date(Date.UTC(2026, 8, d))
const data: Row[] = [1, 2, 3, 4].map((d) => ({ t: day(d), a: d * 10, b: d, c: -d }))
const x = (d: Row): Date => d.t
const a: ChartSeries<Row> = {
  key: 'a',
  label: 'Alpha',
  color: 'var(--vx-line)',
  getValue: (d) => d.a,
}
const b: ChartSeries<Row> = {
  key: 'b',
  label: 'Beta',
  color: 'var(--vx-accent)',
  getValue: (d) => d.b,
}

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

async function mount(node: React.ReactNode): Promise<HTMLElement> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => {
    root?.render(node)
  })
  return el
}

function yDomainOf(spec: StoredChartSpec): number[] {
  const y = spec.scales['y']
  if (!y) throw new Error('no y scale')
  return (y.scale as unknown as { domain: () => number[] }).domain()
}

describe('Lines', () => {
  test('a legend toggle hides the series from the plot and from the auto domain', async () => {
    const el = await mount(<Lines ariaLabel="L" data={data} x={x} series={[a, b]} />)
    const keys = (): string[] =>
      [...el.querySelectorAll('[data-ts-key$=":segment:0"]')].map(
        (p) => p.getAttribute('data-ts-key') ?? '',
      )
    expect(keys().some((k) => k.startsWith('a:'))).toBe(true)
    const toggle = el.querySelector('button[data-legend-key="a"]')
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('no toggleable legend entry')
    expect(toggle.getAttribute('aria-pressed')).toBe('true')
    await act(async () => toggle.click())
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(keys().some((k) => k.startsWith('a:'))).toBe(false)
    expect(keys().some((k) => k.startsWith('b:'))).toBe(true)
  })

  test('the hidden series leaves the y domain (compiled definition)', () => {
    const base = { chartId: 'h', data, x, series: [a, b], marks: () => [] }
    const build = (hidden: Set<string>) =>
      compileCartesian({ ...base, hidden }).chart({
        width: 640,
        height: 240,
        defaultTheme: {} as never,
      })
    expect(yDomainOf(build(new Set()))[1]).toBeGreaterThan(40)
    expect(yDomainOf(build(new Set(['a'])))[1]).toBeLessThan(10)
  })

  test('one legend entry: no toggle; legend={false}: no legend', async () => {
    const one = await mount(<Lines ariaLabel="L" data={data} x={x} series={[a]} />)
    expect(one.querySelector('button[data-legend-key]')).toBeNull()
    expect(one.querySelector('[data-legend-key="a"]')).not.toBeNull()
    act(() => root?.unmount())
    const none = await mount(
      <Lines ariaLabel="L" data={data} x={x} series={[a, b]} legend={false} />,
    )
    expect(none.querySelector('[data-basalt-chart-legend]')).toBeNull()
  })

  test('a companion (legend: false + parent) hides with its parent', async () => {
    const ma: ChartSeries<Row> = { ...b, key: 'ma', label: 'MA', legend: false, parent: 'a' }
    const el = await mount(<Lines ariaLabel="L" data={data} x={x} series={[a, b, ma]} />)
    expect(el.querySelector('[data-legend-key="ma"]')).toBeNull()
    const toggle = el.querySelector('button[data-legend-key="a"]') as HTMLButtonElement
    await act(async () => toggle.click())
    expect(el.querySelector('[data-ts-key^="ma:"]')).toBeNull()
  })

  test('area, dash, markers and thresholds compile to their marks', () => {
    const html = renderToString(
      <Lines
        ariaLabel="L"
        data={data}
        x={x}
        series={[
          { ...a, area: true, getMarker: (d) => (d.a === 40 ? { color: 'var(--vx-good)' } : null) },
          { ...b, dash: 'dashed', axis: 'right' },
        ]}
        y2={{}}
        thresholds={[{ value: 25, side: 'above', fill: 'var(--vx-bad)' }]}
      />,
    )
    expect(html).toContain('<linearGradient')
    expect(html).toMatch(/fill="url\(#[^"]*basalt-area-0[^"]*\)"/)
    expect(html).toContain('stroke-dasharray="6 4"')
    expect(html).toContain('fill="var(--vx-good)"')
    expect(html).toContain('data-ts-key="threshold-0:positive"')
    expect(html).toContain('y2-tick-label')
  })

  test('end labels at the wide class only, never with y2', () => {
    const marksAt = (width: number, y2: boolean): string[] => {
      let ids: string[] = []
      const def = compileCartesian({
        chartId: 'end',
        data,
        x,
        series: [a, b],
        ...(y2 && { y2: {} }),
        marks: (plot) => {
          ids = plot.containerClass === 'wide' && plot.y2 === undefined ? ['wide'] : []
          return []
        },
      })
      def.chart({ width, height: 300, defaultTheme: {} as never })
      return ids
    }
    expect(marksAt(1000, false)).toEqual(['wide'])
    expect(marksAt(640, false)).toEqual([])
    expect(marksAt(1000, true)).toEqual([])
    const html = renderToString(<Lines ariaLabel="L" data={data} x={x} series={[a]} />)
    expect(html).not.toContain('a-end-label') // SSR renders the regular class
  })

  test('tooltip content: one row per visible series, then the consumer rows', () => {
    const def = compileCartesian({
      chartId: 'tip',
      data,
      x,
      series: [a, { ...b, tooltip: false }],
      marks: () => [],
      tooltip: { rows: (d, { visible }) => [{ label: 'Visible', value: String(visible.length) }] },
    })
    const tooltip = def.tooltip
    if (!tooltip || tooltip === true || !('content' in tooltip) || !tooltip.content)
      throw new Error('no tooltip')
    const point = {
      datum: { x: day(2), y: 20, series: 'a', datum: data[1] },
      xValue: day(2),
    } as ChartPoint
    const content = tooltip.content([point], {} as never)
    expect(content.title).toBe('Wed Sep 2 2026')
    expect(content.rows.map((r) => r.label)).toEqual(['Alpha', 'Visible'])
  })

  test('state replaces the plot with its placeholder', () => {
    expect(
      renderToString(
        <Lines ariaLabel="L" data={[]} x={x} series={[a]} state={{ pending: true }} />,
      ),
    ).toContain('aria-busy="true"')
    expect(
      renderToString(
        <Lines ariaLabel="L" data={[]} x={x} series={[a]} state={{ empty: 'Nothing yet' }} />,
      ),
    ).toContain('Nothing yet')
  })
})

describe('Bars', () => {
  const bars = [
    { key: 'a', label: 'A', color: 'var(--vx-line)', getValue: (d: Row) => d.a },
    { key: 'b', label: 'B', color: 'var(--vx-accent)', getValue: (d: Row) => d.b },
  ]

  test('a stacked auto domain reads the per-x totals; grouped reads the series max', () => {
    const stacked = compileCartesian({
      chartId: 's',
      data,
      x,
      series: bars.map((s) => ({ ...s, mark: 'bar' as const })),
      marks: () => [],
      band: true,
      stack: 'stacked',
    })
    const grouped = compileCartesian({
      chartId: 'g',
      data,
      x,
      series: bars.map((s) => ({ ...s, mark: 'bar' as const })),
      marks: () => [],
      band: true,
    })
    const build = (def: typeof stacked) =>
      def.chart({ width: 640, height: 240, defaultTheme: {} as never })
    expect(yDomainOf(build(stacked))[1]).toBeCloseTo(44 * 1.1)
    expect(yDomainOf(build(grouped))[1]).toBeCloseTo(40 * 1.1)
  })

  test('a negative series diverges below zero', () => {
    const def = compileCartesian({
      chartId: 'n',
      data,
      x,
      series: [
        { ...bars[1]!, mark: 'bar' },
        { key: 'c', label: 'C', color: 'var(--vx-bad)', mark: 'bar', getValue: (d: Row) => d.c },
      ],
      marks: () => [],
      band: true,
      stack: 'stacked',
    })
    expect(
      yDomainOf(def.chart({ width: 640, height: 240, defaultTheme: {} as never }))[0],
    ).toBeLessThan(-4)
  })

  test('normalized spans [0, 1]', () => {
    const def = compileCartesian({
      chartId: 'p',
      data,
      x,
      series: bars.map((s) => ({ ...s, mark: 'bar' as const })),
      marks: () => [],
      band: true,
      stack: 'normalized',
    })
    expect(yDomainOf(def.chart({ width: 640, height: 240, defaultTheme: {} as never }))).toEqual([
      0, 1,
    ])
  })

  test('renders bars, an overlay line on y2 and the opacity function', () => {
    const html = renderToString(
      <Bars
        ariaLabel="B"
        data={data}
        x={x}
        bars={bars}
        lines={[
          {
            key: 'm',
            label: 'M',
            color: 'var(--vx-ink2)',
            getValue: (d) => d.b,
            axis: 'right',
            dash: 'dashed',
          },
        ]}
        y2={{}}
        barOpacity={(d) => (d.t.getTime() === day(4).getTime() ? 0.4 : 1)}
      />,
    )
    expect(html).toContain('ts-chart__bar-y')
    expect(html).toContain('color-mix(in srgb, var(--vx-line) 40%, transparent)')
    expect(html).toContain('stroke-dasharray="6 4"')
    expect(html).toContain('y2-tick-label')
  })

  test('a string x is a band scale too', () => {
    const html = renderToString(
      <Bars
        ariaLabel="B"
        data={[
          { k: '0–5', v: 3 },
          { k: '5–10', v: 7 },
        ]}
        x={(d) => d.k}
        bars={[{ key: 'v', label: 'V', color: 'var(--vx-line)', getValue: (d) => d.v }]}
      />,
    )
    expect(html).toContain('5–10')
  })
})

describe('ChartCard', () => {
  test('a header-placed legend renders in the card header row', async () => {
    const el = await mount(
      <ChartCard title="Card">
        <Lines ariaLabel="L" data={data} x={x} series={[a, b]} legend={{ placement: 'header' }} />
      </ChartCard>,
    )
    const slot = el.querySelector('[data-basalt-legend-slot]')
    expect(slot?.querySelector('button[data-legend-key="b"]')).not.toBeNull()
    expect(el.querySelector('[data-basalt-chart] [data-basalt-chart-legend]')).toBeNull()
  })

  test('the card state replaces the body and keeps the header', () => {
    const html = renderToString(
      <ChartCard title="Card" state={{ error: new Error('boom') }}>
        <span>never</span>
      </ChartCard>,
    )
    expect(html).toContain('Card')
    expect(html).toContain('boom')
    expect(html).not.toContain('never')
  })
})
