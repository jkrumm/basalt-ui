/**
 * `Donut` — slice folding, the side-legend label format and the one share denominator. The wrapper
 * width is faked through `useChartSize` (delegating to the real hook when no size is set) because
 * the DOM harness has no layout, and the side legend only exists on a measured, wide frame.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, mock, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import * as realChartSize from '../hooks/useChartSize'
import { Donut } from './Donut'
import type { DonutDatum } from './Donut'

// Captured before the mock lands: the namespace binding is live and would resolve to the mock.
const realUseChartSize = realChartSize.useChartSize

let fakeSize: { width: number; height: number } | null = null

void mock.module('../hooks/useChartSize', () => ({
  useChartSize: (debounceMs?: number) => {
    const real = realUseChartSize(debounceMs)
    return fakeSize === null ? real : { ...real, ...fakeSize }
  },
}))

afterEach(() => {
  fakeSize = null
  cleanup()
})

type Key = string
const colorForKey = (): string => '#123456'
const formatValue = (v: number): string => `v${String(v)}`
const datum = (key: Key, value: number): DonutDatum<Key> => ({ key, value })

function html(data: DonutDatum<Key>[], props: { height?: number } = { height: 240 }): string {
  return renderToStaticMarkup(
    <Donut<Key> data={data} colorForKey={colorForKey} formatValue={formatValue} {...props} />,
  )
}

const legendKeys = (markup: string): string[] =>
  [...markup.matchAll(/data-legend-key="([^"]+)"/g)].map((m) => m[1]!)

describe('Donut — Other bucket', () => {
  const eight = Array.from({ length: 8 }, (_, i) => datum(`k${i}`, i + 1))

  test('7 or more slices fold the smallest into one "Other" legend entry', () => {
    const keys = legendKeys(html(eight))
    expect(keys).toHaveLength(7)
    expect(html(eight)).toContain('>Other<')
  })

  test('up to 6 slices pass through with no "Other"', () => {
    expect(html(eight.slice(0, 6))).not.toContain('>Other<')
  })

  test('an input key already named __other does not collide with the bucket', () => {
    const data = [
      datum('__other', 50),
      ...eight.slice(0, 7).map((d) => datum(`x${d.key}`, d.value)),
    ]
    const keys = legendKeys(html(data))
    expect(keys).toHaveLength(7)
    expect(new Set(keys).size).toBe(7)
    expect(keys).toContain('__other')
  })
})

describe('Donut — shares', () => {
  test('side layout labels each slice with value and whole percent', () => {
    fakeSize = { width: 900, height: 240 }
    const markup = html([datum('a', 1), datum('b', 3)])
    expect(markup).toContain('a · v1 · 25%')
    expect(markup).toContain('b · v3 · 75%')
  })

  test('a total of 0 reads 0%, never NaN', () => {
    fakeSize = { width: 900, height: 240 }
    const markup = html([datum('a', 0), datum('b', 0)])
    expect(markup).toContain('a · v0 · 0%')
    expect(markup).not.toContain('NaN')
  })

  test('the tooltip share equals the legend share', () => {
    fakeSize = { width: 900, height: 240 }
    const { container } = render(
      <Donut<Key>
        data={[datum('a', 1), datum('b', 3)]}
        colorForKey={colorForKey}
        formatValue={formatValue}
        height={240}
      />,
    )
    const arcs = container.querySelectorAll('svg g[style*="cursor"]')
    expect(arcs.length).toBe(2)
    // `useDiscreteCursor` branches on `pointerType !== 'mouse'` (pen counts as coarse too) — jsdom's
    // synthetic default is `''`, not `'mouse'`, so this must be explicit or the hover path no-ops.
    fireEvent.pointerEnter(arcs[0]!, { pointerType: 'mouse', clientX: 10, clientY: 10 })
    const share = screen.getByText('Share').parentElement
    expect(share?.textContent).toContain('25%')
    expect(container.textContent).toContain('a · v1 · 25%')
  })
})

const shareText = (): string | null | undefined =>
  screen.queryByText('Share')?.parentElement?.textContent

describe('Donut — touch and keyboard parity (useDiscreteCursor)', () => {
  function renderTwo() {
    fakeSize = { width: 900, height: 240 }
    return render(
      <Donut<Key>
        data={[datum('a', 1), datum('b', 3)]}
        colorForKey={colorForKey}
        formatValue={formatValue}
        height={240}
      />,
    )
  }

  test('a tap pins the tooltip; lift does not dismiss it, a tap outside does', () => {
    const { container } = renderTwo()
    const arcs = container.querySelectorAll('svg g[role="option"]')
    expect(arcs.length).toBe(2)

    fireEvent.pointerDown(arcs[0]!, { pointerType: 'touch', pointerId: 1 })
    fireEvent.pointerUp(arcs[0]!, { pointerType: 'touch', pointerId: 1 })
    expect(shareText()).toContain('25%')

    fireEvent.pointerLeave(arcs[0]!, { pointerType: 'touch' })
    expect(shareText()).toContain('25%')

    fireEvent.pointerDown(document.body, { pointerType: 'touch' })
    expect(screen.queryByText('Share')).toBeNull()
  })

  test('a cancelled press (a scroll) clears the provisional readout', () => {
    const { container } = renderTwo()
    const arcs = container.querySelectorAll('svg g[role="option"]')
    fireEvent.pointerDown(arcs[0]!, { pointerType: 'touch', pointerId: 1 })
    expect(shareText()).toContain('25%')

    fireEvent.pointerCancel(arcs[0]!, { pointerType: 'touch', pointerId: 1 })
    expect(screen.queryByText('Share')).toBeNull()
  })

  test('a tap on the other slice moves the pin', () => {
    const { container } = renderTwo()
    const arcs = container.querySelectorAll('svg g[role="option"]')
    fireEvent.pointerDown(arcs[0]!, { pointerType: 'touch', pointerId: 1 })
    fireEvent.pointerUp(arcs[0]!, { pointerType: 'touch', pointerId: 1 })
    expect(shareText()).toContain('25%')
    fireEvent.pointerDown(arcs[1]!, { pointerType: 'touch', pointerId: 1 })
    fireEvent.pointerUp(arcs[1]!, { pointerType: 'touch', pointerId: 1 })
    expect(shareText()).toContain('75%')
  })

  test('the ring is one focusable listbox; arrow keys step between slices, Escape dismisses', () => {
    const { container } = renderTwo()
    const host = screen.getByRole('listbox')
    expect(host.tagName).toBe('svg')
    expect(container.querySelectorAll('g[role="option"]')).toHaveLength(2)

    fireEvent.keyDown(host, { key: 'ArrowRight' })
    expect(shareText()).toContain('25%')
    fireEvent.keyDown(host, { key: 'ArrowRight' })
    expect(shareText()).toContain('75%')

    fireEvent.keyDown(host, { key: 'Escape' })
    expect(screen.queryByText('Share')).toBeNull()
  })
})
