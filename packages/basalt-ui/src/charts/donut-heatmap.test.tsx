/**
 * `Donut` and `Heatmap` behaviour through their public props: the rendered DOM and the tooltip a
 * pointer opens, never the engine's internals.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Donut } from './Donut'
import { Heatmap } from './Heatmap'

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
  return document.querySelector('[role="status"]')?.textContent ?? ''
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

type Cell = { row: string; col: string; v: number | null }
const grid = {
  getRow: (d: Cell) => d.row,
  getCol: (d: Cell) => d.col,
  getValue: (d: Cell) => d.v,
}
const cells: Cell[] = [
  { row: 'Mon', col: '0', v: 2 },
  { row: 'Mon', col: '1', v: null },
  { row: 'Tue', col: '1', v: 8 },
]

const plotRects = (el: HTMLElement): Element[] => [...el.querySelectorAll('.ts-chart__marks rect')]
const inked = (el: HTMLElement): string[] =>
  plotRects(el)
    .map((r) => r.getAttribute('fill') ?? '')
    .filter((f) => f.startsWith('color-mix'))
const flat = (el: HTMLElement): Element[] =>
  plotRects(el).filter((r) => r.getAttribute('fill') === 'var(--vx-neutral)')
const bandY = (el: HTMLElement, label: string): number =>
  Number([...el.querySelectorAll('text')].find((t) => t.textContent === label)?.getAttribute('y'))
const bandX = (el: HTMLElement, label: string): number =>
  Number([...el.querySelectorAll('text')].find((t) => t.textContent === label)?.getAttribute('x'))

async function inkOf(data: Cell[], domain?: readonly [number, number]): Promise<string[]> {
  const el = await mount(
    <Heatmap ariaLabel="H" data={data} {...grid} {...(domain && { domain })} />,
  )
  return inked(el)
}

describe('Heatmap', () => {
  test('a cell per datum; absent cells are flat neutral with no hatch', async () => {
    const el = await mount(
      <Heatmap ariaLabel="H" data={cells} {...grid} rows={['Mon', 'Tue']} cols={['0', '1', '2']} />,
    )
    expect(inked(el)).toHaveLength(2)
    // One null value plus three pairs with no datum: the six-cell grid minus the two measured.
    expect(flat(el)).toHaveLength(4)
    expect(el.querySelector('pattern')).toBeNull()
    expect(el.innerHTML).not.toContain('url(#')
  })

  test('bands run in the order given: rows top-down, columns left-right', async () => {
    const el = await mount(
      <Heatmap ariaLabel="H" data={cells} {...grid} rows={['Tue', 'Mon']} cols={['2', '1', '0']} />,
    )
    expect(bandY(el, 'Tue')).toBeLessThan(bandY(el, 'Mon'))
    expect(bandX(el, '2')).toBeLessThan(bandX(el, '1'))
    expect(bandX(el, '1')).toBeLessThan(bandX(el, '0'))
  })

  test('without explicit bands they are first seen in the data', async () => {
    const el = await mount(<Heatmap ariaLabel="H" data={cells} {...grid} />)
    expect(bandY(el, 'Mon')).toBeLessThan(bandY(el, 'Tue'))
    expect(bandX(el, '0')).toBeLessThan(bandX(el, '1'))
  })

  test('intensity is absolute: the same value is the same ink in two grids', async () => {
    const alone = await inkOf([{ row: 'a', col: 'x', v: 5 }], [0, 10])
    const withPeak = await inkOf(
      [
        { row: 'a', col: 'x', v: 5 },
        { row: 'a', col: 'y', v: 10 },
      ],
      [0, 10],
    )
    expect(alone[0]).toBe(withPeak[0])
    expect(withPeak[1]).not.toBe(withPeak[0])
  })

  test('the default domain is [0, max]: the peak is full ink, a half is not', async () => {
    const ink = await inkOf([
      { row: 'a', col: 'x', v: 5 },
      { row: 'a', col: 'y', v: 10 },
    ])
    expect(ink[1]).toContain('100%')
    expect(ink[0]).not.toBe(ink[1])
  })

  test('a flat or inverted domain does not collapse the scale', async () => {
    const data = [{ row: 'a', col: 'x', v: 3 }]
    for (const domain of [
      [3, 3],
      [5, 1],
    ] as const) {
      const ink = await inkOf(data, domain)
      expect(ink).toHaveLength(1)
    }
  })

  test('a non-finite value is absent, not drawn as ink', async () => {
    const data = [
      { row: 'a', col: 'x', v: Number.NaN },
      { row: 'a', col: 'y', v: Number.POSITIVE_INFINITY },
      { row: 'a', col: 'z', v: 4 },
    ]
    const el = await mount(<Heatmap ariaLabel="H" data={data} {...grid} />)
    expect(inked(el)).toHaveLength(1)
    expect(flat(el)).toHaveLength(2)
  })

  test('data=[] without a state draws an empty grid', async () => {
    const el = await mount(<Heatmap ariaLabel="H" data={[]} {...grid} />)
    expect(el.querySelector('svg')).not.toBeNull()
    expect(inked(el)).toHaveLength(0)
  })

  test('gradient legend by default, none with legend={false}; never a crosshair', async () => {
    const withLegend = await mount(<Heatmap ariaLabel="H" data={cells} {...grid} />)
    expect(withLegend.querySelector('.ts-chart__legend--gradient')).not.toBeNull()
    expect(withLegend.querySelector('[class*="crosshair"]')).toBeNull()
    const without = await mount(<Heatmap ariaLabel="H" data={cells} {...grid} legend={false} />)
    expect(without.querySelector('.ts-chart__legend--gradient')).toBeNull()
  })

  test('the tooltip reads row · column, the value and the caller rows', async () => {
    const el = await mount(
      <Heatmap
        ariaLabel="H"
        data={cells}
        {...grid}
        rows={['Mon', 'Tue']}
        cols={['0', '1']}
        formatValue={(v) => `${v} km`}
        formatRow={(r) => `Day ${r}`}
        tooltip={{ rows: (d) => [{ label: 'Samples', value: String(d.v) }] }}
      />,
    )
    const tip = await hover(el, 100, 28)
    expect(tip).toContain('Day Mon · 0')
    expect(tip).toContain('2 km')
    expect(tip).toContain('Samples')
  })

  test('an absent cell with a datum still opens a tooltip that says so', async () => {
    const el = await mount(
      <Heatmap ariaLabel="H" data={cells} {...grid} rows={['Mon', 'Tue']} cols={['0', '1']} />,
    )
    expect(await hover(el, 400, 28)).toContain('No data')
  })

  test('matchHeight fills the parent; state replaces the grid', async () => {
    const el = await mount(<Heatmap ariaLabel="H" data={cells} {...grid} matchHeight />)
    expect(el.firstElementChild instanceof HTMLElement && el.firstElementChild.style.height).toBe(
      '100%',
    )
    const empty = await mount(<Heatmap ariaLabel="H" data={[]} {...grid} state={{ empty: true }} />)
    expect(empty.querySelector('svg')).toBeNull()
    expect(empty.textContent).toContain('No data')
  })
})
