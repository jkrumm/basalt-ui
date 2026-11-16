/**
 * The chart kit fixes of expression cycle 4 (`v3-expr-4-kit-fixes`) a happy-dom page can show:
 * arrow order, group announcements, tooltips at a gap and the money delta. The geometry ones live
 * in `tests/layout/charts-expr4.layout.test.ts`.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { useChartFocus } from './focus'
import { CartesianChart } from './parts/cartesian'

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
const press = (target: Element, key: string) =>
  act(async () => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))
  })

const COLOR = { light: 'var(--vx-line)', dark: 'var(--vx-line)' }

type Pt = { name: string; x: number; y: number }
/** Sorted by descending x: the data order is not the x order. */
const DESCENDING: readonly Pt[] = [
  { name: 'c', x: 30, y: 3 },
  { name: 'b', x: 20, y: 2 },
  { name: 'a', x: 10, y: 1 },
]

function Scatter({ data }: { data: readonly Pt[] }) {
  const focus = useChartFocus(data, { announce: (d) => d.name })
  return (
    <div>
      <output data-readout="">{focus.readout('none', (d) => d.name)}</output>
      <CartesianChart<Pt>
        ariaLabel="Scatter"
        data={data}
        x={{ value: (d) => d.x }}
        series={[{ key: 'y', label: 'Y', color: COLOR, mark: 'dot', y: (d) => d.y }]}
        cursor="expr4-scatter"
        focus={focus}
      />
    </div>
  )
}

describe('arrow order', () => {
  test('ArrowRight steps through a chart whose data is sorted by descending x', async () => {
    const el = await mount(<Scatter data={DESCENDING} />)
    const wrap = el.querySelector('[data-chart-focus]') as Element
    const seen: (string | null | undefined)[] = []
    for (let i = 0; i < 3; i++) {
      await press(wrap, 'ArrowRight')
      seen.push(readout(el))
    }
    expect(seen).toEqual(['a', 'b', 'c'])
    await press(wrap, 'ArrowLeft')
    expect(readout(el)).toBe('b')
  })
})
