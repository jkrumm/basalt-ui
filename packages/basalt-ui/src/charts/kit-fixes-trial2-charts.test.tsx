/**
 * Trial 2 kit defects on the charts: `ChartCard` applies `empty` only to settled-empty data and draws its
 * own Retry (26, 27), a Heatmap takes `height="fill"` (10), `useChartFocus` takes `undefined` items before
 * the query settles (14), the readout hides the nearest y tick (28), and a negative bar's value stands
 * outside its end, in the ink of a positive one (9).
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import type { ReactElement } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { yTickOpacity } from './core/readout-clear'
import type { ReadoutFocus } from './core/readout-clear'
import { useChartFocus } from './focus'
import type { ChartFocus } from './focus'
import { Bars } from './parts/bars'
import { ChartCard } from './parts/chart-card'
import { Heatmap } from './parts/heatmap'

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
  return el
}

const settled = (data: unknown) => ({ isPending: false, isError: false, error: null, data })

const chart = (): ReactElement => <p>the chart</p>
const refetch = (): void => undefined

describe('ChartCard empty with a query', () => {
  const empty = { cause: 'Nothing recorded' }

  test('rows loaded: the chart draws, the cause does not', async () => {
    const el = await mount(<ChartCard title="T" chart={chart} phase={settled([1])} empty={empty} />)
    expect(el.textContent).toContain('the chart')
    expect(el.textContent).not.toContain('Nothing recorded')
  })

  test('an object result says when it is empty with `when`', async () => {
    const none = { cause: 'Nothing recorded', when: (d: unknown) => (d as { n: number }).n === 0 }
    const full = await mount(
      <ChartCard title="T" chart={chart} phase={settled({ n: 2 })} empty={none} />,
    )
    expect(full.textContent).toContain('the chart')
    act(() => root?.unmount())
    const zero = await mount(
      <ChartCard title="T" chart={chart} phase={settled({ n: 0 })} empty={none} />,
    )
    expect(zero.textContent).toContain('Nothing recorded')
  })
})

describe('ChartCard error', () => {
  test('a card holding a query has its own Retry beside a group sharing the refetch', async () => {
    const failed = {
      isPending: false,
      isError: true,
      error: new Error('boom'),
      refetch,
      data: undefined,
    }
    const el = await mount(
      <>
        <ChartCard title="A" chart={() => null} phase={failed} />
        <ChartCard title="B" chart={() => null} phase={failed} />
      </>,
    )
    const buttons = [...el.querySelectorAll('[role="alert"] button')].filter(
      (b) => b.textContent === 'Retry',
    )
    expect(buttons.length).toBe(2)
  })
})

describe('Heatmap height fill', () => {
  const data = [
    { r: 'a', c: '1', v: 1 },
    { r: 'a', c: '2', v: 2 },
  ]
  const heatmap = (extra: { height?: 'fill'; matchHeight?: boolean }): ReactElement => (
    <Heatmap
      label="H"
      data={data}
      getRow={(d) => d.r}
      getCol={(d) => d.c}
      getValue={(d) => d.v}
      {...extra}
    />
  )

  test("height='fill' draws what matchHeight draws", async () => {
    const filled = await mount(heatmap({ height: 'fill' }))
    const box = filled.querySelector('[data-basalt-box="fill"]')
    const rootEl = filled.querySelector('[data-basalt-chart]') as HTMLElement
    expect(box).not.toBeNull()
    expect(rootEl.style.height).toBe('100%')
    const drawn = filled.innerHTML
    act(() => root?.unmount())
    const matched = await mount(heatmap({ matchHeight: true }))
    expect(matched.innerHTML).toBe(drawn)
  })

  test('the card box height compiles into Heatmap', async () => {
    const el = await mount(
      <ChartCard
        title="T"
        height="short"
        chart={(box) => (
          <Heatmap
            label="H"
            data={data}
            getRow={(d) => d.r}
            getCol={(d) => d.c}
            getValue={(d) => d.v}
            height={box.height}
          />
        )}
      />,
    )
    expect(el.querySelector('[data-basalt-box="fill"]')).not.toBeNull()
  })
})

describe('useChartFocus before the query settles', () => {
  type Row = { id: number }
  let handle: ChartFocus<Row> | undefined
  function Probe({ rows }: { rows: readonly Row[] | undefined }): null {
    handle = useChartFocus(rows, { announce: (d) => String(d.id) })
    return null
  }

  test('undefined items hold no focus and keep one handle until rows arrive', async () => {
    await mount(<Probe rows={undefined} />)
    expect(handle?.items).toEqual([])
    expect(handle?.datum).toBeNull()
    const first = handle
    await act(async () => root?.render(<Probe rows={undefined} />))
    expect(handle?.items).toBe(first?.items as readonly Row[])
    await act(async () => root?.render(<Probe rows={[{ id: 1 }, { id: 2 }]} />))
    expect(handle?.items.length).toBe(2)
  })
})

const focus = (y: number): ReadoutFocus => ({ primary: { x: 100, y, xValue: 3, yValue: 79 } })

describe('the y readout hides the nearest tick', () => {
  const opacity = yTickOpacity({ fontSize: 11, chip: true })

  test('the tick one unit from the readout (79 over 80) is blanked', () => {
    expect(opacity({ value: 80, position: 99, focus: focus(103) })).toBe(0)
  })

  test('a tick a label height away stays', () => {
    expect(opacity({ value: 60, position: 160, focus: focus(103) })).toBe(1)
  })
})

describe('bar values of negative bars', () => {
  const COLOR = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }
  const DATA = [263, 150, 96, 20, -11, -27, -31].map((a, i) => ({ k: `b${i}`, a }))
  const html = renderToString(
    <Bars
      label="V"
      data={DATA}
      height={300}
      x={{ value: (d) => d.k }}
      series={[{ mark: 'bar', key: 'a', label: 'A', color: COLOR, y: (d) => d.a, values: true }]}
    />,
  )
  const labels = [
    ...html.matchAll(/<text data-ts-key="bar-values-y[^>]*? fill="([^"]*)"[^>]*>([^<]*)<\/text>/g),
  ]

  test('every value, a negative bar at the floor included, is written outside its bar in the card ink', () => {
    expect(labels.map((m) => m[2])).toContain('-31')
    expect(labels.length).toBe(DATA.length)
    for (const [, fill] of labels) expect(fill).toBe('var(--basalt-ink-muted)')
  })
})
