/**
 * The geometry seam's focus on the engine hosts (Issue 1019): a `Heatmap` and a `CartesianChart`
 * each focus one datum on arrow keys and on pointer, dim the rest, drive one bound readout that
 * returns to the total on leave, and say it in one polite live region. With `focus` the host's
 * wrapper is the one tab stop; the engine's own keyboard is off.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { useChartFocus } from './focus'
import { CartesianChart } from './parts/cartesian'
import { Heatmap, stepGrid } from './parts/heatmap'

type Cell = { row: string; col: string; v: number }
const CELLS: readonly Cell[] = [
  { row: 'orders', col: '08', v: 1 },
  { row: 'orders', col: '09', v: 9 },
  { row: 'billing', col: '08', v: 2 },
  { row: 'billing', col: '09', v: 3 },
]

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})

async function mount(node: ReactElement): Promise<HTMLElement> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  await act(async () => root?.render(node))
  await act(async () => new Promise((r) => setTimeout(r, 20)))
  return el
}

const readout = (el: HTMLElement) => el.querySelector('[data-readout]')?.textContent
const live = (el: HTMLElement) => el.querySelector('[data-chart-focus-live]')?.textContent
const press = (target: Element, key: string) =>
  act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })
const point = (target: Element, clientX: number, clientY: number) =>
  act(async () => {
    target.dispatchEvent(
      new PointerEvent('pointermove', { bubbles: true, clientX, clientY, pointerType: 'mouse' }),
    )
  })

/** The fill opacity of every drawn cell rect, in DOM order. */
const opacities = (el: HTMLElement) =>
  [...el.querySelectorAll('rect[data-ts-key^="cells"]')].map((r) => r.getAttribute('fill-opacity'))

function Grid() {
  const focus = useChartFocus(CELLS, { announce: (d) => `${d.row} at ${d.col}: ${d.v}%` })
  return (
    <div>
      <output data-readout="">
        {focus.readout('15 failures', (d) => `${d.row} ${d.col}h ${d.v}%`)}
      </output>
      <Heatmap
        label="Failures"
        data={CELLS}
        getRow={(d) => d.row}
        getCol={(d) => d.col}
        getValue={(d) => d.v}
        rows={['orders', 'billing']}
        annotate={(d) => (d.v > 5 ? '!' : null)}
        focus={focus}
      />
    </div>
  )
}

describe('Heatmap focus', () => {
  test('the wrapper is the only tab stop; at rest nothing dims', async () => {
    const el = await mount(<Grid />)
    const stops = el.querySelectorAll('[tabindex="0"]')
    expect(stops.length).toBe(1)
    expect(stops[0]?.hasAttribute('data-chart-focus')).toBe(true)
    expect(readout(el)).toBe('15 failures')
    expect(opacities(el).every((o) => o === null)).toBe(true)
  })

  test('arrow keys step the grid, dim the rest and drive the readout', async () => {
    const el = await mount(<Grid />)
    const wrap = el.querySelector('[data-chart-focus]') as Element
    await press(wrap, 'ArrowRight')
    expect(readout(el)).toBe('orders 08h 1%')
    await press(wrap, 'ArrowRight')
    expect(readout(el)).toBe('orders 09h 9%')
    await press(wrap, 'ArrowDown')
    expect(readout(el)).toBe('billing 09h 3%')
    expect(live(el)).toBe('billing at 09: 3%')
    // Three cells dim to DIMMED of the ramp's full fill; the focused one is its own mark.
    expect(opacities(el).filter((o) => o !== null).length).toBe(3)
    await press(wrap, 'Escape')
    expect(readout(el)).toBe('15 failures')
    expect(live(el)).toBe('')
  })

  test('pointing at a cell focuses it', async () => {
    const el = await mount(<Grid />)
    const svg = el.querySelector('svg') as Element
    await point(svg, 500, 40)
    expect(readout(el)).toBe('orders 09h 9%')
    expect(opacities(el).filter((o) => o !== null).length).toBe(3)
  })

  test('annotate draws its text in the cell', async () => {
    const el = await mount(<Grid />)
    expect([...el.querySelectorAll('text')].some((t) => t.textContent === '!')).toBe(true)
  })
})

describe('stepGrid', () => {
  const grid = [
    ['a', undefined, 'c'],
    [undefined, 'e', 'f'],
  ]
  const at = (d: string) => ['a', 'c', 'e', 'f'].indexOf(d)
  test('skips holes along a row and a column, stops at the edge', () => {
    expect(stepGrid(grid, 'ArrowRight', 'a', at)).toBe(at('c'))
    expect(stepGrid(grid, 'ArrowRight', 'c', at)).toBe(at('c'))
    expect(stepGrid(grid, 'ArrowDown', 'c', at)).toBe(at('f'))
    expect(stepGrid(grid, 'ArrowDown', 'a', at)).toBe(at('a'))
  })
  test('enters at the first or last datum, Escape clears, other keys are not ours', () => {
    expect(stepGrid(grid, 'ArrowDown', undefined, at)).toBe(at('a'))
    expect(stepGrid(grid, 'ArrowUp', undefined, at)).toBe(at('f'))
    expect(stepGrid(grid, 'End', 'a', at)).toBe(at('f'))
    expect(stepGrid(grid, 'Escape', 'a', at)).toBeNull()
    expect(stepGrid(grid, 'Tab', 'a', at)).toBeUndefined()
  })
})

type Stage = { stage: string; at: number; behind: number }
const STAGES: readonly Stage[] = [
  { stage: 'Build', at: 1, behind: 12 },
  { stage: 'Test', at: 2, behind: 94 },
  { stage: 'Deploy', at: 3, behind: -8 },
]
const COLOR = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }

function Pace3() {
  const focus = useChartFocus(STAGES, { announce: (d) => `${d.stage}: ${d.behind} s behind` })
  return (
    <div>
      <output data-readout="">{focus.readout('+98 s', (d) => `${d.stage} ${d.behind} s`)}</output>
      <CartesianChart
        label="Pace"
        data={STAGES}
        x={{ value: (d) => d.stage }}
        series={[{ key: 'behind', label: 'Behind', color: COLOR, mark: 'bar', y: (d) => d.behind }]}
        cursor="focus-3"
        focus={focus}
      />
    </div>
  )
}

/** The fills of the drawn bars, in DOM order. */
const barFills = (el: HTMLElement) =>
  [...el.querySelectorAll('[data-ts-key^="bars"]:not(g)')].map((b) => b.getAttribute('fill') ?? '')

describe('CartesianChart focus', () => {
  test('arrow keys dim the other bars and drive the readout', async () => {
    const el = await mount(<Pace3 />)
    const wrap = el.querySelector('[data-chart-focus]') as Element
    const rest = barFills(el)
    expect(rest.length).toBe(3)
    await press(wrap, 'ArrowRight')
    await press(wrap, 'ArrowRight')
    expect(readout(el)).toBe('Test 94 s')
    // The default bar shade is 85%; the two others draw at DIMMED of it (43%).
    const fills = barFills(el)
    expect(fills.filter((f) => f.includes(' 43%')).length).toBe(2)
    expect(fills[1]).not.toContain(' 43%')
    await press(wrap, 'Escape')
    expect(readout(el)).toBe('+98 s')
    expect(barFills(el)).toEqual(rest)
  })

  test('pointing at a bar focuses it', async () => {
    const el = await mount(<Pace3 />)
    await point(el.querySelector('svg') as Element, 100, 100)
    expect(readout(el)).toBe('Build 12 s')
  })
})
