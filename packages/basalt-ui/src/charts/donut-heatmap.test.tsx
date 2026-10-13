/**
 * `Donut` and `Heatmap` behaviour through their public props: what the rendered DOM says, never the
 * engine's internals.
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
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => {
    root?.render(node)
  })
  return el
}

const arcs = (el: HTMLElement): Element[] => [...el.querySelectorAll('.ts-chart__arc path')]
const color = (): string => 'var(--vx-line)'

const slices = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ key: `k${i}`, value: (i + 1) * 10 }))

describe('Donut', () => {
  const base = { ariaLabel: 'Split', colorForKey: color, formatValue: String }

  test('draws one arc per slice, names the chart and prints the centre text', async () => {
    const el = await mount(
      <Donut {...base} data={slices(3)} centerLabel="60" centerSubLabel="total" />,
    )
    expect(arcs(el)).toHaveLength(3)
    expect(el.querySelector('svg')?.getAttribute('aria-label')).toBe('Split')
    expect(el.textContent).toContain('60')
    expect(el.textContent).toContain('total')
  })

  test('folds everything past six slices into one neutral Other', async () => {
    const el = await mount(<Donut {...base} data={slices(9)} />)
    expect(arcs(el)).toHaveLength(7)
    const other = el.querySelector('[data-legend-key="__other"]')
    expect(other?.textContent).toContain('Other')
    // 1..3 fold: (10 + 20 + 30) of 450.
    expect(other?.textContent).toContain('60 · 13%')
  })

  test('a legend toggle drops the slice from the ring but not from the shares', async () => {
    const el = await mount(<Donut {...base} data={slices(3)} />)
    const toggle = el.querySelector('button[data-legend-key="k0"]')
    if (!(toggle instanceof HTMLButtonElement)) throw new Error('no toggleable legend entry')
    await act(async () => toggle.click())
    expect(arcs(el)).toHaveLength(2)
    expect(toggle.getAttribute('aria-pressed')).toBe('false')
    expect(toggle.textContent).toContain('17%')
  })

  test('the legend sits beside a wide ring and below a tall one', async () => {
    const wide = await mount(<Donut {...base} data={slices(3)} height={200} />)
    expect(
      wide.firstElementChild instanceof HTMLElement && wide.firstElementChild.style.flexDirection,
    ).toBe('row')
    act(() => root?.unmount())
    document.body.innerHTML = ''
    const tall = await mount(<Donut {...base} data={slices(3)} height={480} />)
    expect(
      tall.firstElementChild instanceof HTMLElement && tall.firstElementChild.style.flexDirection,
    ).toBe('column')
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

const group = (el: HTMLElement, id: string): Element[] => [
  ...el.querySelectorAll(`[data-ts-key="${id}"] rect`),
]

async function fills(data: Cell[]): Promise<string[]> {
  const el = await mount(<Heatmap ariaLabel="H" data={data} {...grid} domain={[0, 10]} />)
  const out = group(el, 'cells').map((r) => r.getAttribute('fill') ?? '')
  act(() => root?.unmount())
  document.body.innerHTML = ''
  return out
}

describe('Heatmap', () => {
  test('a cell per datum, absent cells flat neutral with no hatch', async () => {
    const el = await mount(
      <Heatmap ariaLabel="H" data={cells} {...grid} rows={['Mon', 'Tue']} cols={['0', '1', '2']} />,
    )
    expect(group(el, 'cells')).toHaveLength(2)
    // null value + two pairs with no datum: the six-cell grid minus the two measured cells.
    const absent = [...group(el, 'absent'), ...group(el, 'absent-empty')]
    expect(absent).toHaveLength(4)
    for (const rect of absent) expect(rect.getAttribute('fill')).toBe('var(--vx-neutral)')
    expect(el.querySelector('pattern')).toBeNull()
    expect(el.innerHTML).not.toContain('url(#')
  })

  test('rows run top-down in the order given and every band is labelled', async () => {
    const el = await mount(
      <Heatmap ariaLabel="H" data={cells} {...grid} rows={['Mon', 'Tue']} cols={['0', '1', '2']} />,
    )
    const label = (key: string): number =>
      Number(el.querySelector(`[data-ts-key="y-tick-label:string:3:${key}"]`)?.getAttribute('y'))
    expect(label('Mon')).toBeLessThan(label('Tue'))
    expect(el.querySelectorAll('[data-ts-key^="x-tick-label"]')).toHaveLength(3)
  })

  test('intensity is absolute: the same value is the same ink in two grids', async () => {
    const alone = await fills([{ row: 'a', col: 'x', v: 5 }])
    const withPeak = await fills([
      { row: 'a', col: 'x', v: 5 },
      { row: 'a', col: 'y', v: 10 },
    ])
    expect(alone[0]).toBe(withPeak[0])
    expect(withPeak[1]).not.toBe(withPeak[0])
  })

  test('gradient legend by default, none with legend={false}; never a crosshair', async () => {
    const withLegend = await mount(<Heatmap ariaLabel="H" data={cells} {...grid} />)
    expect(withLegend.querySelector('.ts-chart__legend--gradient')).not.toBeNull()
    expect(withLegend.querySelector('[data-ts-key*="crosshair"]')).toBeNull()
    act(() => root?.unmount())
    document.body.innerHTML = ''
    const without = await mount(<Heatmap ariaLabel="H" data={cells} {...grid} legend={false} />)
    expect(without.querySelector('.ts-chart__legend--gradient')).toBeNull()
  })

  test('matchHeight fills the parent; state replaces the grid', async () => {
    const el = await mount(<Heatmap ariaLabel="H" data={cells} {...grid} matchHeight />)
    expect(el.firstElementChild instanceof HTMLElement && el.firstElementChild.style.height).toBe(
      '100%',
    )
    act(() => root?.unmount())
    document.body.innerHTML = ''
    const empty = await mount(<Heatmap ariaLabel="H" data={[]} {...grid} state={{ empty: true }} />)
    expect(empty.querySelector('svg')).toBeNull()
    expect(empty.textContent).toContain('No data')
  })
})
