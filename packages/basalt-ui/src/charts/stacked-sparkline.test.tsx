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

const render = (node: React.ReactNode): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(node)
  return el
}

const attr = (el: Element | null, name: string): number => Number(el?.getAttribute(name))
const tick = (el: HTMLElement, v: number): Element | null =>
  el.querySelector(`[data-ts-key="y-tick-label:number:${v}"]`)

const segments = (rows: Row[]): number =>
  renderToString(<StackedArea ariaLabel="S" data={rows} x={x} series={[a, b]} />).split(':segment:')
    .length - 1

describe('StackedArea', () => {
  test('bands stack in series order: the first is the bottom band', () => {
    const html = renderToString(<StackedArea ariaLabel="S" data={data} x={x} series={[a, b]} />)
    const paths = [
      ...html.matchAll(/data-ts-key="bands:[^"]*:(a|b):segment:0"[^>]* d="M([\d.]+),([\d.]+)/g),
    ]
    const top = (key: string): number => Number(paths.find((m) => m[1] === key)?.[3])
    // Smaller y is higher on the page: band b sits above band a.
    expect(top('b')).toBeLessThan(top('a'))
  })

  test('the y domain is the visible stack total, shrinking when a band is toggled off', async () => {
    const el = await mount(
      <StackedArea ariaLabel="S" data={data} x={x} series={[a, b]} y={{ ticks: [0, 3] }} />,
    )
    const both = attr(tick(el, 3), 'y')
    const toggle = el.querySelector('button[data-legend-key="a"]')
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('no toggleable legend entry')
    await act(async () => toggle.click())
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    // Tick 3 climbs toward the top once the 10-40 band stops setting the axis.
    expect(attr(tick(el, 3), 'y')).toBeLessThan(both - 100)
    expect(el.querySelectorAll('[data-ts-key^="bands:"]').length).toBeGreaterThan(0)
  })

  test('every band hidden draws nothing and does not throw', async () => {
    const el = await mount(<StackedArea ariaLabel="S" data={data} x={x} series={[a]} />)
    expect(el.querySelectorAll('[data-ts-key^="bands:"]').length).toBeGreaterThan(0)
    const solo = await mount(
      <StackedArea ariaLabel="S" data={data} x={x} series={[a, b]} legend={{ toggle: true }} />,
    )
    for (const key of ['a', 'b']) {
      const btn = solo.querySelector(`button[data-legend-key="${key}"]`)
      if (btn instanceof HTMLButtonElement) await act(async () => btn.click())
    }
    expect(solo.querySelector('[data-ts-key^="bands:"]')).toBeNull()
  })

  test('a null band gaps the whole stack at that row', () => {
    const sparse = data.map((d, i) => (i === 1 ? { ...d, a: null } : d))
    // Two bands, each one segment dense; the gap splits each into two.
    expect(segments(data)).toBe(2)
    expect(segments(sparse)).toBeGreaterThan(2)
  })

  test('y.format drives the axis labels', () => {
    const html = renderToString(
      <StackedArea
        ariaLabel="S"
        data={data}
        x={x}
        series={[a, b]}
        y={{ ticks: [0, 20], format: (v) => `${v} USD` }}
      />,
    )
    expect(html).toContain('>20 USD<')
  })
})

describe('Sparkline', () => {
  const values = [3, 5, 4, 8, 6]

  test('line: one path, no axes, grid or legend', () => {
    const el = render(<Sparkline ariaLabel="Trend" data={values} height={28} width={80} />)
    expect(el.querySelectorAll('path[data-ts-key^="line"]').length).toBe(1)
    expect(el.querySelector('[data-ts-key*="tick-label"]')).toBeNull()
    expect(el.querySelector('[data-ts-key*="grid"]')).toBeNull()
    expect(el.querySelector('[data-legend-key]')).toBeNull()
    expect(el.querySelector('svg')?.getAttribute('aria-label')).toBe('Trend')
  })

  test('bar: one finite rect per value, the last alone in the emphasis color', () => {
    const el = render(
      <Sparkline
        ariaLabel="Loss"
        data={values}
        height={28}
        mark="bar"
        emphasizeLast
        emphasisColor="var(--vx-bad)"
      />,
    )
    const rects = [...el.querySelectorAll('rect[data-ts-key^="bars:"]')]
    expect(rects.length).toBe(values.length)
    for (const r of rects) {
      expect(Number.isFinite(attr(r, 'x'))).toBe(true)
      expect(attr(r, 'width')).toBeGreaterThan(0)
    }
    expect(rects.map((r) => r.getAttribute('fill'))).toEqual([
      ...values.slice(1).map(() => 'var(--vx-faint)'),
      'var(--vx-bad)',
    ])
    // The tallest value (8) fills the box: the ceiling comes from the data.
    expect(Math.min(...rects.map((r) => attr(r, 'y')))).toBe(0)
  })

  test('bar ceiling follows the data, not a constant', () => {
    const el = render(<Sparkline ariaLabel="T" data={[0.2, 0.4]} height={28} mark="bar" />)
    const tallest = Math.min(
      ...[...el.querySelectorAll('rect[data-ts-key^="bars:"]')].map((r) => attr(r, 'y')),
    )
    expect(tallest).toBe(0)
  })

  test('line emphasis: the last-point dot sits inside the box, and only when asked', () => {
    const plain = render(<Sparkline ariaLabel="T" data={values} height={28} />)
    expect(plain.querySelector('circle')).toBeNull()
    const el = render(<Sparkline ariaLabel="T" data={values} height={28} emphasizeLast />)
    const dotEl = el.querySelector('circle[data-ts-key^="last"]')
    expect(dotEl?.getAttribute('fill')).toBe('var(--vx-accent)')
    const viewBoxW = Number(el.querySelector('svg')?.getAttribute('viewBox')?.split(' ')[2])
    expect(attr(dotEl, 'cx') + attr(dotEl, 'r')).toBeLessThanOrEqual(viewBoxW)
  })

  test('width: fixed sizes the box, omitted fills the container', () => {
    expect(
      render(<Sparkline ariaLabel="T" data={values} height={28} width={80} />).innerHTML,
    ).toContain('width:80px')
    expect(render(<Sparkline ariaLabel="T" data={values} height={28} />).innerHTML).toContain(
      'width:100%',
    )
  })

  test('non-finite values are gaps; all-non-finite and empty data draw no chart', () => {
    const gapped = render(<Sparkline ariaLabel="T" data={[1, Number.NaN, 3, 4]} height={28} />)
    expect(gapped.querySelectorAll('path[data-ts-key^="line"]').length).toBe(2)
    for (const bad of [[], [Number.NaN, Number.POSITIVE_INFINITY]]) {
      const el = render(<Sparkline ariaLabel="T" data={bad} height={28} />)
      expect(el.querySelector('svg')).toBeNull()
      expect(el.querySelector('[data-basalt-sparkline]')).not.toBeNull()
    }
  })

  test('a single point renders finite geometry', () => {
    const one = render(<Sparkline ariaLabel="T" data={[5]} height={28} emphasizeLast />)
    expect(Number.isFinite(attr(one.querySelector('circle'), 'cy'))).toBe(true)
  })
})
