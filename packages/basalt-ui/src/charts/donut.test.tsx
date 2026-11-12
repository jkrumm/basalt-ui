/**
 * `Donut` behaviour through its public props: the rendered DOM and the tooltip a
 * pointer opens, never the engine's internals.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { TOOLTIP_READOUT } from './cursor'
import { Donut } from './Donut'

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

async function mount(node: React.ReactNode): Promise<HTMLElement> {
  act(() => root?.unmount())
  document.body.innerHTML = ''
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => {
    root?.render(node)
  })
  return el
}

/** Moves a pointer over the chart and returns the text of the tooltip it opened. */
async function hover(el: HTMLElement, x: number, y: number): Promise<string> {
  const svg = el.querySelector('svg')
  if (!svg) throw new Error('chart did not mount')
  await act(async () => {
    svg.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true }))
    await new Promise((r) => setTimeout(r, 30))
  })
  return document.querySelector(TOOLTIP_READOUT)?.textContent ?? ''
}

const arcs = (el: HTMLElement): Element[] => [...el.querySelectorAll('.ts-chart__arc path')]
const legendEntry = (el: HTMLElement, label: string): Element | undefined =>
  [...el.querySelectorAll('[data-legend-key]')].find((e) => e.textContent?.startsWith(label))
const color = (): string => 'var(--vx-line)'
const slices = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ key: `k${i}`, value: (i + 1) * 10 }))

describe('Donut', () => {
  const base = { ariaLabel: 'Split', colorForKey: color, formatValue: String }

  test('draws one arc per slice, names the chart and exposes the centre text', async () => {
    const el = await mount(
      <Donut {...base} data={slices(3)} centerLabel="60" centerSubLabel="total" />,
    )
    expect(arcs(el)).toHaveLength(3)
    expect(el.querySelector('svg')?.getAttribute('aria-label')).toBe('Split')
    expect(el.textContent).toContain('60')
    expect(el.textContent).toContain('total')
    const headline = [...el.querySelectorAll('span')].find((s) => s.textContent === '60')
    expect(headline).toBeDefined()
    expect(headline?.closest('[aria-hidden]')).toBeNull()
  })

  test('six slices stay six; a seventh folds the smallest two into one Other', async () => {
    const six = await mount(<Donut {...base} data={slices(6)} />)
    expect(arcs(six)).toHaveLength(6)
    expect(legendEntry(six, 'Other')).toBeUndefined()
    const seven = await mount(<Donut {...base} data={slices(7)} />)
    // Top six stay (k1..k6); k0 (10) folds alone into Other, 10 of 280.
    expect(arcs(seven)).toHaveLength(7)
    expect(legendEntry(seven, 'Other')?.textContent).toContain('10 · 4%')
    expect(legendEntry(seven, 'k0')).toBeUndefined()
  })

  test('a user key named like the fold does not collide with Other', async () => {
    const data = [...slices(7), { key: 'other', value: 500 }, { key: '__other', value: 400 }]
    const el = await mount(<Donut {...base} data={data} />)
    const labels = [...el.querySelectorAll('[data-legend-key]')].map((e) => e.textContent)
    expect(labels.filter((t) => t?.startsWith('Other'))).toHaveLength(1)
    expect(labels.filter((t) => t?.startsWith('other'))).toHaveLength(1)
    expect(labels.filter((t) => t?.startsWith('__other'))).toHaveLength(1)
  })

  test('duplicate keys add up into one slice', async () => {
    const data = [
      { key: 'a', value: 10 },
      { key: 'b', value: 10 },
      { key: 'a', value: 30 },
    ]
    const el = await mount(<Donut {...base} data={data} />)
    expect(arcs(el)).toHaveLength(2)
    expect(legendEntry(el, 'a')?.textContent).toContain('40 · 80%')
  })

  test('non-finite, zero and negative values are absent, not zero-width slices', async () => {
    const data = [
      { key: 'a', value: 10 },
      { key: 'nan', value: Number.NaN },
      { key: 'neg', value: -5 },
      { key: 'zero', value: 0 },
      { key: 'inf', value: Number.POSITIVE_INFINITY },
    ]
    const el = await mount(<Donut {...base} data={data} />)
    expect(arcs(el)).toHaveLength(1)
    expect(el.querySelectorAll('[data-legend-key]')).toHaveLength(1)
  })

  test('a legend toggle drops the slice from the ring but not from the shares', async () => {
    const el = await mount(<Donut {...base} data={slices(3)} />)
    const toggle = legendEntry(el, 'k0')
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('no toggleable legend entry')
    await act(async () => toggle.click())
    expect(arcs(el)).toHaveLength(2)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(toggle.textContent).toContain('17%')
  })

  test('hovering a legend entry dims the other slices', async () => {
    const el = await mount(<Donut {...base} data={slices(3)} />)
    const fills = (): (string | null)[] => arcs(el).map((a) => a.getAttribute('fill'))
    expect(new Set(fills()).size).toBe(1)
    const entry = legendEntry(el, 'k0')
    if (!entry) throw new Error('no legend entry')
    await act(async () => {
      entry.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      entry.dispatchEvent(new MouseEvent('mouseenter'))
    })
    expect(new Set(fills()).size).toBe(2)
  })

  test('the tooltip names the slice with its value and its share of the whole', async () => {
    const el = await mount(
      <Donut
        {...base}
        data={[
          { key: 'a', value: 30 },
          { key: 'b', value: 10 },
        ]}
        seriesLabel={(k) => k.toUpperCase()}
        formatValue={(v) => `$${v}`}
      />,
    )
    // 12 o'clock clockwise: 'a' covers the right half of the ring and more. happy-dom has no
    // layout, so the engine draws its 640 × 320 default and the ring is centred on (320, 160).
    const tip = await hover(el, 450, 160)
    expect(tip).toContain('A')
    expect(tip).toContain('$30')
    expect(tip).toContain('75%')
    expect(document.querySelector(TOOLTIP_READOUT)?.getAttribute('role')).toBe('tooltip')
  })

  test('data=[] without a state draws an empty ring, no slices and no legend', async () => {
    const el = await mount(<Donut {...base} data={[]} />)
    expect(arcs(el)).toHaveLength(0)
    expect(el.querySelector('[data-legend-key]')).toBeNull()
  })

  test('state replaces the ring and the legend', async () => {
    const el = await mount(<Donut {...base} data={[]} state={{ empty: 'Nothing billed' }} />)
    expect(el.querySelector('svg')).toBeNull()
    expect(el.querySelector('[data-legend-key]')).toBeNull()
    expect(el.textContent).toContain('Nothing billed')
  })
})
