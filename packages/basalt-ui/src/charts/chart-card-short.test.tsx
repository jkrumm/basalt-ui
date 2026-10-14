/**
 * Who decides a `ChartCard` is short (V2-SPEC § 9.6, W10): a chart box that states a height decides
 * it in CSS (`data-basalt-chart-short`), so the card must NOT also measure itself; a `fill` box and a
 * body that is not a chart state nothing, so the card measures them (`data-basalt-card-short`,
 * under 280 px, leaving at 304 px). The choice is made at mount: a box does not appear later.
 */
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { ChartCard } from './ChartCard'
import { Heatmap } from './Heatmap'
import { Lines } from './Lines'

type Entry = {
  borderBoxSize: { blockSize: number }[]
  contentRect: { width: number; height: number }
}
type Callback = (entries: Entry[]) => void
let observers: Callback[] = []
const original = globalThis.ResizeObserver

beforeEach(() => {
  observers = []
  globalThis.ResizeObserver = class {
    constructor(callback: Callback) {
      observers.push(callback)
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver
})
afterEach(() => {
  globalThis.ResizeObserver = original
})

/** Reports the card's height to every observer a card created. */
const resize = (blockSize: number): void => {
  act(() => {
    for (const callback of observers)
      callback([{ borderBoxSize: [{ blockSize }], contentRect: { width: 358, height: blockSize } }])
  })
}
const isShort = (el: HTMLElement): boolean =>
  el.querySelector('[data-basalt-chart-card]')?.hasAttribute('data-basalt-card-short') ?? false

const data = [{ t: new Date(Date.UTC(2026, 8, 1)), v: 1 }]
const lines = (extra: object = {}): ReactElement => (
  <Lines
    ariaLabel="L"
    data={data}
    x={(d) => d.t}
    series={[{ key: 'v', label: 'V', color: 'var(--vx-line)', getValue: (d) => d.v }]}
    {...extra}
  />
)
const fill = (): ReactElement => (
  <Heatmap
    ariaLabel="H"
    data={[{ r: 'Mon', c: '0', v: 1 }]}
    getRow={(d) => d.r}
    getCol={(d) => d.c}
    getValue={(d) => d.v}
    matchHeight
  />
)

describe('ChartCard short measurement', () => {
  test('a body that is not a chart is measured: short under 280, out at 304', () => {
    const { container } = render(
      <ChartCard title="T">
        <div />
      </ChartCard>,
    )
    expect(isShort(container)).toBe(false)
    resize(279)
    expect(isShort(container)).toBe(true)
    resize(290) // inside the hysteresis band: stays short
    expect(isShort(container)).toBe(true)
    resize(304)
    expect(isShort(container)).toBe(false)
  })

  test('a fill chart box states no height, so the card is measured', () => {
    const { container } = render(<ChartCard title="T">{fill()}</ChartCard>)
    resize(120)
    expect(isShort(container)).toBe(true)
  })

  test.each([
    ['a stated height', lines({ height: 120 })],
    ['the height law', lines()],
  ])('%s: the box decides in CSS, the card never measures itself', (_name, chart) => {
    const { container } = render(<ChartCard title="T">{chart}</ChartCard>)
    resize(120)
    expect(isShort(container)).toBe(false)
  })
})
