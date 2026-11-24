/**
 * Expression cycle 7 (`v3-expr-7-kit-fixes` 4): under a focus a chart of two or more lines dims each
 * line in its own hue at reduced weight, and a direct series label dims with its line. One line
 * keeps the shared dim.
 */
import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { useEffect } from 'react'
import { useChartFocus } from './focus'
import { dimmedHuePaint, dimmedPaint, linePaint } from './marks'
import { Lines } from './parts/lines'
import type { LineSeries } from './parts/lines'
import type { ChartSeries, PlotContext } from './types'

afterEach(cleanup)

type Row = { at: number; a: number; b: number }
const ROWS: readonly Row[] = [1, 2, 3, 4, 5].map((at) => ({ at, a: at * 2, b: 12 - at }))
const A = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }
const B = { light: 'var(--basalt-good)', dark: 'var(--basalt-good)' }
let handle: ReturnType<typeof useChartFocus<Row>> | undefined

const SERIES: LineSeries<Row>[] = [
  { key: 'a', label: 'Alpha', color: A, mark: 'line', y: (d) => d.a },
  { key: 'b', label: 'Beta', color: B, mark: 'line', y: (d) => d.b },
]

function Chart({ lines }: { lines: 1 | 2 }) {
  const focus = useChartFocus(ROWS, { announce: (d) => String(d.at) })
  useEffect(() => {
    handle = focus
  })
  return (
    <Lines<Row>
      label="Two lines"
      data={ROWS}
      x={{ value: (d) => d.at }}
      focus={focus}
      naming="endLabels"
      series={SERIES.slice(0, lines)}
    />
  )
}

const settle = () => act(async () => new Promise((r) => setTimeout(r, 20)))
const stroke = (el: HTMLElement, key: string) => {
  const path = el.querySelector(`path[data-ts-key^="${key}:"]`)
  return { color: path?.getAttribute('stroke'), width: Number(path?.getAttribute('stroke-width')) }
}
const label = (el: HTMLElement, key: string) =>
  el.querySelector(`text[data-ts-key^="${key}-end-label"]`)?.getAttribute('fill')

describe('focus on a chart of lines', () => {
  test('two lines: each keeps its own hue at a thinner stroke, and its label dims with it', async () => {
    const { container } = render(<Chart lines={2} />)
    await settle()
    const rest = { a: stroke(container, 'a'), b: stroke(container, 'b') }
    expect(rest.a.color).not.toBeUndefined()
    await act(async () => handle?.set(2))
    await settle()
    const held = { a: stroke(container, 'a'), b: stroke(container, 'b') }
    expect(held.a.color).not.toBe(held.b.color)
    expect(held.a.width).toBeLessThan(rest.a.width)
    expect(label(container, 'a')).toBe(held.a.color ?? '')
    expect(label(container, 'b')).toBe(held.b.color ?? '')
  })

  test('one line keeps the shared dim at its full width', async () => {
    const { container } = render(<Chart lines={1} />)
    await settle()
    const rest = stroke(container, 'a')
    await act(async () => handle?.set(2))
    await settle()
    expect(stroke(container, 'a').width).toBe(rest.width)
  })
})

describe('linePaint', () => {
  const line = (key: string): ChartSeries<number> =>
    ({ key, mark: 'line' }) as unknown as ChartSeries<number>
  const plot = (visible: ChartSeries<number>[], focused: number | null) =>
    ({ visible, focused }) as unknown as PlotContext<number, number>

  test('no focus is the series color; two lines dim to their hue; one dims to the shared paint', () => {
    expect(linePaint(plot([line('a'), line('b')], null), '#123456')).toBe('#123456')
    expect(linePaint(plot([line('a'), line('b')], 1), '#123456')).toBe(dimmedHuePaint('#123456'))
    expect(linePaint(plot([line('a')], 1), '#123456')).toBe(dimmedPaint('#123456'))
  })
})
