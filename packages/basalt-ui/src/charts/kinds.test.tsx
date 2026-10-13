/**
 * `Lines`, `Bars` and `ChartCard` behaviour through their public props: what the compiled
 * definition and the rendered DOM say, never the engine's internals.
 */
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import type { ChartPoint, StoredChartSpec } from '@tanstack/charts/types/core'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { Bars } from './Bars'
import { CartesianChart } from './CartesianChart'
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

  test("a right-axis reference line without y2 stays inside the left axis' domain", () => {
    const def = compileCartesian({
      chartId: 'r',
      data,
      x,
      series: [a],
      marks: () => [],
      refLines: [{ value: 200, color: 'var(--vx-bad)', axis: 'right' }],
    })
    expect(
      yDomainOf(def.chart({ width: 640, height: 240, defaultTheme: {} as never }))[1],
    ).toBeGreaterThanOrEqual(200)
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
    if (!tooltip || !('content' in tooltip) || !tooltip.content) throw new Error('no tooltip')
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

  test('a header legend renders in a card that has no other header field', async () => {
    const el = await mount(
      <ChartCard>
        <Lines ariaLabel="L" data={data} x={x} series={[a, b]} legend={{ placement: 'header' }} />
      </ChartCard>,
    )
    expect(el.querySelector('[data-basalt-legend-slot] button[data-legend-key="a"]')).not.toBeNull()
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

const build = (def: ReturnType<typeof compileCartesian>): StoredChartSpec =>
  def.chart({ width: 640, height: 240, defaultTheme: {} as never })

function contentOf(
  def: ReturnType<typeof compileCartesian>,
  datum: unknown,
  xValue: unknown,
): { title?: string | undefined; rows: readonly { label: string; value: string }[] } {
  const tooltip = def.tooltip
  if (!tooltip || !('content' in tooltip) || !tooltip.content) throw new Error('no tooltip')
  return tooltip.content([{ datum, xValue } as ChartPoint], {} as never)
}

const tooltipOf = (def: ReturnType<typeof compileCartesian>, at: number) =>
  contentOf(def, { x: day(at), y: 0, series: 'a', datum: data[at - 1] }, day(at))

describe('x-zones', () => {
  const base = { chartId: 'xz', data, x, series: [a], marks: () => [] }
  test('an x-zone adds a decorative mark and the shared fraction scale', () => {
    const plain = build(compileCartesian(base))
    const zoned = build(
      compileCartesian({ ...base, xZones: [{ from: day(2), to: day(3), fill: 'var(--vx-line)' }] }),
    )
    expect(zoned.marks.length).toBe(plain.marks.length + 1)
    expect(plain.scales['zx']).toBeUndefined()
    expect(zoned.scales['zx']?.channel).toBe('x')
  })
})

const noMarks = (): never[] => []
const tipBase = { chartId: 'tt', data, x, series: [a, b], marks: () => [] }
const labelsOf = (reverseRows: boolean): string[] =>
  tooltipOf(compileCartesian({ ...tipBase, reverseRows }), 2).rows.map((r) => r.label)
const headerOf = (extra: object): string | undefined =>
  tooltipOf(compileCartesian({ ...tipBase, ...extra }), 2).title

describe('tooltip', () => {
  const base = tipBase

  test('reverseRows lists the series bottom-up, so a stack reads top-down', () => {
    expect(labelsOf(false)).toEqual(['Alpha', 'Beta'])
    expect(labelsOf(true)).toEqual(['Beta', 'Alpha'])
  })

  test('a series note joins its label; a formatValue beats the axis format', () => {
    const rows = tooltipOf(
      compileCartesian({
        ...base,
        series: [{ ...a, note: 'est.', formatValue: (v) => `${v} ms` }],
      }),
      2,
    ).rows
    expect(rows).toEqual([expect.objectContaining({ label: 'Alpha · est.', value: '20 ms' })])
  })

  test('header: formatHeader wins, then a long UTC date, then formatX', () => {
    expect(headerOf({})).toBe('Wed Sep 2 2026')
    expect(headerOf({ formatX: () => 'X' })).toBe('X')
    expect(headerOf({ formatX: () => 'X', tooltip: { formatHeader: () => 'H' } })).toBe('H')
    expect(headerOf({ tooltip: { formatHeader: (d: Date) => d.toISOString().slice(0, 4) } })).toBe(
      '2026',
    )
  })

  test('a non-midnight instant adds its UTC time to the date header', () => {
    const at = new Date(Date.UTC(2026, 8, 2, 13, 5))
    const def = compileCartesian({ ...base, data: [{ ...data[1], t: at } as Row] })
    const datum = { x: at, y: 0, series: 'a', datum: { t: at, a: 1 } }
    expect(contentOf(def, datum, at).title).toBe('Wed Sep 2 2026 13:05')
  })

  test('a number x with no formatX reads through the axis format', () => {
    const def = compileCartesian({
      chartId: 'nx',
      data: [{ n: 1500, v: 1 }],
      x: (d) => d.n,
      series: [{ key: 'v', label: 'V', color: 'c', getValue: (d: { v: number }) => d.v }],
      marks: () => [],
    })
    expect(contentOf(def, { n: 1500, v: 1 }, 1500).title).toBe('1.5k')
  })
})

describe('legend', () => {
  test('groups split series | overlay | reference with a divider, notes beside the label', async () => {
    const roled: ChartSeries<Row>[] = [
      { ...a, note: 'daily' },
      { ...b, role: 'overlay' },
      { ...a, key: 'c', label: 'Ref', role: 'reference' },
    ]
    const el = await mount(
      <Lines ariaLabel="L" data={data} x={x} series={roled} legend={{ groups: true }} />,
    )
    const legend = el.querySelector('[data-basalt-chart-legend]')
    expect(
      [...(legend?.querySelectorAll('[data-legend-key]') ?? [])].map((n) =>
        n.getAttribute('data-legend-key'),
      ),
    ).toEqual(['a', 'b', 'c'])
    const hidden = (groups: boolean): number => {
      const html = renderToString(
        <Lines ariaLabel="L" data={data} x={x} series={roled} legend={{ groups }} />,
      )
      return html.split('aria-hidden="true"').length - 1
    }
    expect(hidden(true) - hidden(false)).toBe(2) // one divider between each pair of groups
    expect(legend?.textContent).toContain('daily')
  })
})

describe('Bars on a log axis', () => {
  const props = {
    ariaLabel: 'B',
    data,
    x,
    bars: [{ key: 'b', label: 'B', color: 'var(--vx-line)', getValue: (d: Row) => d.b }],
    y: { scale: 'log' as const },
  }
  test('a lines-only Bars on a log axis is fine', () => {
    expect(() =>
      renderToString(<Bars {...props} bars={[]} lines={[{ ...a, key: 'l', label: 'L' }]} />),
    ).not.toThrow()
  })

  test('production logs once instead of throwing', () => {
    const env = process.env['NODE_ENV'] ?? 'test'
    const spy = spyOn(console, 'error').mockImplementation(() => {})
    process.env['NODE_ENV'] = 'production'
    try {
      renderToString(<Bars {...props} />)
      renderToString(<Bars {...props} />)
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      process.env['NODE_ENV'] = env
      spy.mockRestore()
    }
  })

  test('stacked and normalized throw; grouped draws', () => {
    expect(() => renderToString(<Bars {...props} />)).toThrow(/stacked bars cannot use a log axis/)
    expect(() => renderToString(<Bars {...props} layout="normalized" />)).toThrow(/log axis/)
    expect(() => renderToString(<Bars {...props} layout="grouped" />)).not.toThrow()
  })
})

describe('ChartCard slots', () => {
  test('actions, count, subtitle and slot classNames land on their boxes', async () => {
    const el = await mount(
      <ChartCard
        title="Card"
        subtitle="Sub"
        count={7}
        actions={<button type="button">Act</button>}
        className="own"
        classNames={{ root: 'r', header: 'h', body: 'b' }}
        style={{ width: 321 }}
      >
        <span id="child" />
      </ChartCard>,
    )
    const card = el.firstElementChild as HTMLElement
    expect(card.className).toBe('r own')
    expect(card.style.width).toBe('321px')
    expect(el.querySelector('.h')?.textContent).toContain('Card')
    expect(el.querySelector('.h')?.textContent).toContain('Sub')
    expect(el.querySelector('.h [data-basalt-tier="widget"] button')?.textContent).toBe('Act')
    expect(el.querySelector('.b #child')).not.toBeNull()
  })

  test('no title, info, value, icon, count or actions: no header; pending sets aria-busy', async () => {
    const el = await mount(
      <ChartCard subtitle="alone" state={{ pending: true }}>
        <span />
      </ChartCard>,
    )
    expect(el.textContent).not.toContain('alone')
    expect(el.firstElementChild?.getAttribute('aria-busy')).toBe('true')
  })
})

describe('compile memo', () => {
  test('compiles once per changed prop and not at all on a shallow-equal rerender', async () => {
    let compiles = 0
    const one = [data[0] as Row]
    const counted = (d: Row): Date => {
      compiles += 1 // compileCartesian maps `x` over the data exactly once per compile
      return d.t
    }
    const series = [a]
    const view = (refLines?: { value: number; color: string }[]) => (
      <CartesianChart
        ariaLabel="C"
        data={one}
        x={counted}
        series={series}
        marks={noMarks}
        {...(refLines && { refLines })}
      />
    )
    await mount(view())
    expect(compiles).toBe(1)
    await act(async () => root?.render(view()))
    expect(compiles).toBe(1)
    await act(async () => root?.render(view([{ value: 1, color: 'red' }])))
    expect(compiles).toBe(2)
  })
})
