/**
 * The 2.x `window` caption became the label row: `axisLabels` states the span a trend covers, at
 * rest, in a row of its own that the plot never has to give up height for (a 72 px box is a 56 px
 * plot and a 16 px row), and the middle slot doubles as the readout.
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import type { ReactElement } from 'react'
import { Sparkline } from './sparkline'

afterEach(cleanup)

const DAY = 86_400_000
const points = [0, 1, 2, 3].map((i) => ({ at: Date.UTC(2026, 9, 1) + i * 7 * DAY, value: i + 1 }))
const labels = (node: ReactElement): string[] => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(node)
  return [...(el.querySelector('[data-slot="spark-labels"]')?.children ?? [])].map(
    (c) => c.textContent ?? '',
  )
}

describe('Sparkline label row', () => {
  test('a stated span reads its start, its middle and its end', () => {
    expect(
      labels(
        <Sparkline
          series={points}
          ariaLabel="S"
          height={72}
          axisLabels={['1 Oct', '12 wk', '22 Oct']}
        />,
      ),
    ).toEqual(['1 Oct', '12 wk', '22 Oct'])
  })

  test('no axisLabels states no row, and the plot keeps the whole height', () => {
    expect(labels(<Sparkline series={points} ariaLabel="S" height={72} />)).toEqual([])
    const el = document.createElement('div')
    el.innerHTML = renderToString(<Sparkline series={points} ariaLabel="S" height={72} />)
    expect(el.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 100 72')
  })

  test('the row is hidden from assistive tech: the slider carries the readout', () => {
    const el = document.createElement('div')
    el.innerHTML = renderToString(
      <Sparkline series={points} ariaLabel="S" height={72} axisLabels={['a', 'b', 'c']} />,
    )
    expect(el.querySelector('[data-slot="spark-labels"]')?.getAttribute('aria-hidden')).toBe('true')
  })

  test('an hourly series within one day reads its day with each point', () => {
    const hourly = [0, 1, 2].map((i) => ({ at: Date.UTC(2026, 9, 1, i), value: i }))
    const { getByRole } = render(
      <Sparkline series={hourly} ariaLabel="S" height={72} axisLabels={['0h', 'now', '2h']} />,
    )
    const slider = getByRole('slider')
    fireEvent.keyDown(slider, { key: 'Home' })
    expect(slider.getAttribute('aria-valuetext')).toContain('Oct 1')
  })
})
