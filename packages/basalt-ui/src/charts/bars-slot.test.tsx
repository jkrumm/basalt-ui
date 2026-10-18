/** `Bars` in a visual slot (Wave 38): no axes, grid, margin or legend; outside a slot nothing moves. */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Bars } from './Bars'
import { compileCartesian } from './compile'
import { HOSTED, VisualSlotContext } from '../dashboard/visual-slot'
import type { ChartSeries } from './types'

type Bin = { bin: string; n: number }
const data: Bin[] = ['<20', '20–30', '30–40', '40–50', '50+'].map((bin, i) => ({ bin, n: i + 1 }))
const series: ChartSeries<Bin>[] = [
  { key: 'n', label: 'Books', color: 'var(--vx-accent)', getValue: (d) => d.n, mark: 'bar' },
]
const spec = (bare: boolean) =>
  compileCartesian<Bin, string>({
    chartId: 'x',
    data,
    x: (d) => d.bin,
    series,
    marks: () => [],
    band: true,
    ...(bare && { bare }),
  }).chart({ width: 160, height: 22, defaultTheme: {} as never })

describe('compile: bare', () => {
  test('both axes are off, there is no grid and no margin', () => {
    const s = spec(true)
    expect(s.scales['x']?.axis).toBe(false)
    expect(s.scales['y']?.axis).toBe(false)
    expect(s.scales['y']).not.toHaveProperty('grid')
    expect(s.margin).toBe(0)
    expect(s.guides).toBe(false)
  })
  test('without bare the axes, the y grid and the engine margin stay', () => {
    const s = spec(false)
    expect(s.scales['x']?.axis).not.toBe(false)
    expect(s.scales['y']).toHaveProperty('grid')
    expect(s).not.toHaveProperty('margin')
  })
})

let root: ReturnType<typeof createRoot> | undefined
afterEach(() => {
  act(() => root?.unmount())
  root = undefined
  document.body.innerHTML = ''
})
async function mount(slot: boolean): Promise<HTMLElement> {
  const el = document.createElement('div')
  document.body.append(el)
  root = createRoot(el)
  const bars = (
    <Bars
      ariaLabel="Pace"
      data={data}
      x={(d) => d.bin}
      height={22}
      bars={[
        { key: 'n', label: 'Books', color: 'var(--vx-accent)', getValue: (d) => d.n },
        { key: 'm', label: 'Other', color: 'var(--vx-line)', getValue: (d) => d.n },
      ]}
    />
  )
  await act(async () => {
    root?.render(
      slot ? <VisualSlotContext.Provider value={HOSTED}>{bars}</VisualSlotContext.Provider> : bars,
    )
  })
  return el
}

describe('Bars reads the visual slot', () => {
  test('in a slot: no tick text, no legend', async () => {
    const el = await mount(true)
    expect(el.querySelectorAll('svg text')).toHaveLength(0)
    expect(el.querySelector('[data-basalt-chart-legend]')).toBeNull()
  })
  test('outside a slot: the legend of a two-series chart is unchanged', async () => {
    const el = await mount(false)
    expect(el.querySelector('[data-basalt-chart-legend]')).not.toBeNull()
  })
})
