/**
 * `Lines` and `Bars` through their public v3 props: what the compiled definition and the rendered DOM
 * say, never the engine's internals. Ported from the 2.x `kinds.test.tsx`; the assertions are the
 * 2.x ones, the props are the v3 vocabulary (`Series` by `mark`, `{ light, dark }` colours, `phase`).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { ChartPoint, StoredChartSpec } from '@tanstack/charts/types/core'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { defineFormat } from '../../format'
import { resetFormatDefaults } from '../../format/shared'
import { compileCartesian } from '../core/compile'
import type { Series, SeriesColor } from '../contract'
import { Bars } from './bars'
import type { BarsSeries } from './bars'
import { cssColor, toEngineSpec } from './cartesian-adapt'
import { Lines } from './lines'
import type { LineSeries } from './lines'

// The tooltip header reads the page locale: pin one, or the runtime's decides the expected strings.
beforeEach(() => defineFormat({ locale: 'en-GB' }))
afterEach(resetFormatDefaults)

const pair = (v: string): SeriesColor => ({ light: `var(--vx-${v})`, dark: `var(--vx-${v})` })
type Row = { t: Date; a: number | null; b: number; c: number }
const day = (d: number): Date => new Date(Date.UTC(2026, 8, d))
const data: Row[] = [1, 2, 3, 4].map((d) => ({ t: day(d), a: d * 10, b: d, c: -d }))
const x = { value: (d: Row): Date => d.t }
const a: LineSeries<Row> = {
  mark: 'line',
  key: 'a',
  label: 'Alpha',
  color: pair('line'),
  y: (d) => d.a,
}
const b: LineSeries<Row> = {
  mark: 'line',
  key: 'b',
  label: 'Beta',
  color: pair('accent'),
  y: (d) => d.b,
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

const specOf = (series: readonly Series<Row>[], extra: object = {}) => ({
  chartId: 'k',
  ...toEngineSpec({ ariaLabel: 'K', data, x, series }),
  marks: () => [],
  ...extra,
})
const frame = { width: 640, height: 240, defaultTheme: {} as never }

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
    const build = (hidden: Set<string>) =>
      compileCartesian({ ...specOf([a, b]), hidden }).chart(frame)
    expect(yDomainOf(build(new Set()))[1]).toBeGreaterThan(40)
    expect(yDomainOf(build(new Set(['a'])))[1]).toBeLessThan(10)
  })

  test("a right-axis reference line without a right axis stays inside the left axis' domain", () => {
    const def = compileCartesian(
      specOf([a], { refLines: [{ value: 200, color: 'var(--vx-bad)', axis: 'right' }] }),
    )
    expect(yDomainOf(def.chart(frame))[1]).toBeGreaterThanOrEqual(200)
  })

  test('one legend entry: no legend; legend: false on every series: no legend', async () => {
    // A lone series names nothing the title and axis do not.
    const alone = await mount(<Lines ariaLabel="L" data={data} x={x} series={[a]} />)
    expect(alone.querySelector('[data-basalt-chart-legend]')).toBeNull()
    act(() => root?.unmount())
    const none = await mount(
      <Lines
        ariaLabel="L"
        data={data}
        x={x}
        series={[
          { ...a, legend: false },
          { ...b, legend: false },
        ]}
      />,
    )
    expect(none.querySelector('[data-basalt-chart-legend]')).toBeNull()
  })

  test('a companion (legend: false + parent) hides with its parent', async () => {
    const ma: LineSeries<Row> = { ...b, key: 'ma', label: 'MA', legend: false, parent: 'a' }
    const el = await mount(<Lines ariaLabel="L" data={data} x={x} series={[a, b, ma]} />)
    expect(el.querySelector('[data-legend-key="ma"]')).toBeNull()
    const toggle = el.querySelector('button[data-legend-key="a"]') as HTMLButtonElement
    await act(async () => toggle.click())
    expect(el.querySelector('[data-ts-key^="ma:"]')).toBeNull()
  })

  test('area, dash, markers and the right axis compile to their marks', () => {
    const html = renderToString(
      <Lines
        ariaLabel="L"
        data={data}
        x={x}
        series={[
          {
            ...a,
            area: 'fade',
            getMarker: (d) => (d.a === 40 ? { color: 'var(--vx-good)' } : null),
          },
          { ...b, dash: true, axis: 'right' },
        ]}
      />,
    )
    expect(html).toContain('<linearGradient')
    expect(html).toMatch(/fill="url\(#[^"]*basalt-area-0[^"]*\)"/)
    expect(html).toContain('stroke-dasharray="6 4"')
    expect(html).toContain('fill="var(--vx-good)"')
    expect(html).toContain('y2-tick-label')
  })

  test('weight is the closed stroke scale: quiet is thinner than strong', () => {
    const widths = (weight: 'quiet' | 'strong'): number[] => {
      const host = document.createElement('div')
      host.innerHTML = renderToString(
        <Lines ariaLabel="L" data={data} x={x} series={[{ ...a, weight }]} />,
      )
      return [...host.querySelectorAll('g.ts-chart__line[data-ts-key^="a:"] path')].map((p) =>
        Number(p.getAttribute('stroke-width')),
      )
    }
    expect(Math.max(...widths('quiet'))).toBeLessThan(Math.min(...widths('strong')))
  })

  test('end labels at the wide class only, never with a right axis', () => {
    const marksAt = (width: number, right: boolean): string[] => {
      let ids: string[] = []
      const series = right ? [{ ...a, axis: 'right' as const }, b] : [a, b]
      const def = compileCartesian({
        ...specOf(series),
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
    const def = compileCartesian(
      specOf([a, { ...b, tooltip: false }], {
        tooltip: undefined,
        ...toEngineSpecTooltip(),
      }),
    )
    const tooltip = def.tooltip
    if (!tooltip || !('content' in tooltip) || !tooltip.content) throw new Error('no tooltip')
    const point = {
      datum: { x: day(2), y: 20, series: 'a', datum: data[1] },
      xValue: day(2),
    } as ChartPoint
    const content = tooltip.content([point], {} as never)
    expect(content.title).toBe('Wed, 2 Sep 2026')
    expect(content.rows.map((r) => r.label)).toEqual(['Alpha', 'Visible'])
  })

  test('phase replaces the plot with its placeholder', () => {
    expect(
      renderToString(<Lines ariaLabel="L" data={[]} x={x} series={[a]} phase="loading" />),
    ).toContain('aria-busy="true"')
    expect(
      renderToString(
        <Lines
          ariaLabel="L"
          data={[]}
          x={x}
          series={[a]}
          phase={{ tag: 'error', message: 'Boom' }}
        />,
      ),
    ).toContain('Boom')
  })
})

/** The tooltip config through the adapter, so the consumer row reads `visible` as the engine passes it. */
function toEngineSpecTooltip(): object {
  const { tooltip } = toEngineSpec({
    ariaLabel: 'K',
    data,
    x,
    series: [],
    tooltip: { rows: () => [{ label: 'Visible', value: '1' }] },
  })
  return { tooltip }
}

describe('Bars', () => {
  const bars: Extract<BarsSeries<Row>, { mark: 'bar' }>[] = [
    { mark: 'bar', key: 'a', label: 'A', color: pair('line'), y: (d) => d.a },
    { mark: 'bar', key: 'b', label: 'B', color: pair('accent'), y: (d) => d.b },
  ]

  test('a stacked auto domain reads the per-x totals; grouped reads the series max', () => {
    const stacked = compileCartesian(specOf(bars, { band: true, stack: 'stacked' }))
    const grouped = compileCartesian(specOf(bars, { band: true }))
    // 44 padded is 48.4, between ticks: the domain ends on the next tick (50) so the top label covers the stack.
    expect(yDomainOf(stacked.chart(frame))[1]).toBeCloseTo(50)
    expect(yDomainOf(grouped.chart(frame))[1]).toBeCloseTo(40 * 1.1)
  })

  test('a negative series diverges below zero', () => {
    const def = compileCartesian(
      specOf([bars[1]!, { mark: 'bar', key: 'c', label: 'C', color: pair('bad'), y: (d) => d.c }], {
        band: true,
        stack: 'stacked',
      }),
    )
    expect(yDomainOf(def.chart(frame))[0]).toBeLessThan(-4)
  })

  test('normalized spans [0, 1]', () => {
    const def = compileCartesian(specOf(bars, { band: true, stack: 'normalized' }))
    expect(yDomainOf(def.chart(frame))).toEqual([0, 1])
  })

  test('renders bars, an overlay line on the right axis and the opacity function', () => {
    const html = renderToString(
      <Bars
        ariaLabel="B"
        data={data}
        x={x}
        series={[
          {
            ...bars[0]!,
            opacity: (d) => (d.t.getTime() === day(4).getTime() ? 0.4 : 1),
          },
          bars[1]!,
          {
            mark: 'line',
            key: 'm',
            label: 'M',
            color: pair('ink2'),
            y: (d) => d.b,
            axis: 'right',
            dash: true,
          },
        ]}
      />,
    )
    expect(html).toContain('ts-chart__bar-y')
    expect(html).toContain(`color-mix(in srgb, ${cssColor(pair('line'))} 40%, transparent)`)
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
        x={{ value: (d) => d.k }}
        series={[{ mark: 'bar', key: 'v', label: 'V', color: pair('line'), y: (d) => d.v }]}
      />,
    )
    expect(html).toContain('5–10')
  })
})
