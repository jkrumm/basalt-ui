/** `StackedArea` and `Sparkline` through their public props: the rendered DOM, never internals. */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { Sparkline } from './Sparkline'
import { StackedArea } from './StackedArea'
import type { ChartSeries } from './types'

type Row = { t: Date; a: number | null; b: number }
const day = (d: number): Date => new Date(Date.UTC(2026, 8, d))
const data: Row[] = [1, 2, 3, 4].map((d) => ({ t: day(d), a: d * 10, b: d }))
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

describe('StackedArea', () => {
  test('draws one band per series, filled in the series color', () => {
    const html = renderToString(<StackedArea ariaLabel="S" data={data} x={x} series={[a, b]} />)
    expect(html).toContain('var(--vx-line)')
    expect(html).toContain('var(--vx-accent)')
    expect(html).toContain('Alpha')
    expect(html).toContain('Beta')
  })

  test('a legend toggle hides the band and its share of the stack', async () => {
    const el = await mount(<StackedArea ariaLabel="S" data={data} x={x} series={[a, b]} />)
    const bands = (): number => el.querySelectorAll('[data-ts-key^="bands"]').length
    const before = bands()
    expect(before).toBeGreaterThan(0)
    const toggle = el.querySelector('button[data-legend-key="a"]')
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('no toggleable legend entry')
    await act(async () => toggle.click())
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(bands()).toBeLessThan(before)
  })

  test('a null band breaks the whole stack at that row', () => {
    const sparse = data.map((d, i) => (i === 1 ? { ...d, a: null } : d))
    const dense = renderToString(<StackedArea ariaLabel="S" data={data} x={x} series={[a, b]} />)
    const gapped = renderToString(<StackedArea ariaLabel="S" data={sparse} x={x} series={[a, b]} />)
    expect(gapped).not.toBe(dense)
  })

  test('y.format drives the axis labels; cursorResolution is accepted', () => {
    const html = renderToString(
      <StackedArea
        ariaLabel="S"
        data={data}
        x={x}
        series={[a, b]}
        y={{ format: (v) => `${v} USD` }}
        cursorResolution="leading"
      />,
    )
    expect(html).toContain(' USD')
  })
})

describe('Sparkline', () => {
  const values = [3, 5, 4, 8, 6]

  test('line: an svg with no axes, grid or legend', () => {
    const html = renderToString(
      <Sparkline ariaLabel="Trend" data={values} height={28} width={80} />,
    )
    expect(html).toContain('aria-label="Trend"')
    expect(html).toContain('<path')
    expect(html).not.toContain('tick-label')
    expect(html).not.toContain('data-legend-key')
  })

  test('bar: one rect per value, the last in the emphasis color', () => {
    const html = renderToString(
      <Sparkline
        ariaLabel="Loss"
        data={values}
        height={28}
        mark="bar"
        emphasizeLast
        emphasisColor="var(--vx-bad)"
      />,
    )
    expect(html.match(/<rect/g)?.length ?? 0).toBeGreaterThanOrEqual(values.length)
    expect(html).toContain('fill="var(--vx-bad)"')
  })

  test('line emphasis adds a last-point dot; off by default', () => {
    const plain = renderToString(<Sparkline ariaLabel="T" data={values} height={28} />)
    const emphasized = renderToString(
      <Sparkline ariaLabel="T" data={values} height={28} emphasizeLast />,
    )
    expect(plain).not.toContain('var(--vx-accent)')
    expect(emphasized).toContain('var(--vx-accent)')
  })

  test('fixed width sizes the box; omitted, it fills the container', () => {
    const fixed = renderToString(<Sparkline ariaLabel="T" data={values} height={28} width={80} />)
    const fluid = renderToString(<Sparkline ariaLabel="T" data={values} height={28} />)
    expect(fixed).toContain('width:80px')
    expect(fluid).toContain('width:100%')
  })

  test('empty and single-point data render without throwing', () => {
    expect(renderToString(<Sparkline ariaLabel="T" data={[]} height={28} />)).toContain(
      'data-basalt-sparkline',
    )
    expect(renderToString(<Sparkline ariaLabel="T" data={[5]} height={28} />)).toContain('<svg')
  })
})
