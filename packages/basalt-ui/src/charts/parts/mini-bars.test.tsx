import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import type { ReactElement } from 'react'
import { MiniBars } from './mini-bars'

afterEach(cleanup)

const dom = (node: ReactElement): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(node)
  return el
}
const bars = (el: ParentNode): HTMLElement[] => [
  ...el.querySelectorAll<HTMLElement>('[data-slot="spark-bar"]'),
]
const lit = (el: ParentNode): number[] =>
  [...el.querySelectorAll('[data-index]')]
    .filter((s) => s.querySelector('[data-lit]') !== null)
    .map((s) => Number(s.getAttribute('data-index')))

describe('MiniBars', () => {
  test('one lit bar, the last by default; the rest are dim ink', () => {
    const el = dom(<MiniBars points={[1, 2, 3, 4]} label="S" height={40} />)
    expect(lit(el)).toEqual([3])
    const dim = bars(el).filter((b) => !b.hasAttribute('data-lit'))
    expect(dim).toHaveLength(3)
    for (const b of dim) expect(b.className).toContain('bg-foreground/34 dark:bg-foreground/38')
    expect(
      bars(el)
        .find((b) => b.hasAttribute('data-lit'))
        ?.getAttribute('style'),
    ).toContain('var(--spark-now, var(--color-foreground))')
  })

  test('a highlight index lights that bar; an index out of range lights none', () => {
    expect(lit(dom(<MiniBars points={[1, 2, 3]} label="S" height={40} highlight={0} />))).toEqual([
      0,
    ])
    expect(lit(dom(<MiniBars points={[1, 2, 3]} label="S" height={40} highlight={9} />))).toEqual(
      [],
    )
  })

  test('bars rise from a zero baseline and a gap draws no bar', () => {
    const el = dom(<MiniBars points={[5, null, 10]} label="S" height={40} />)
    expect(bars(el)).toHaveLength(2)
    const heights = bars(el).map((b) => Number.parseFloat(b.style.height))
    expect(heights).toEqual([50, 100])
    expect(bars(el)[1]?.style.top).toBe('0%')
  })

  test('the data end is rounded: the top of a bar above zero, the bottom of one below', () => {
    const el = dom(<MiniBars points={[4, -4]} label="S" height={40} />)
    const [up, down] = bars(el)
    expect(up?.className).toContain('rounded-t-[3px]')
    expect(down?.className).toContain('rounded-b-[3px]')
  })

  test('a bar is at most 24 px wide with a 3 px gap', () => {
    const el = dom(<MiniBars points={[1, 2, 3]} label="S" height={40} />)
    const column = el.querySelector('[data-index]')
    expect(column?.className).toContain('max-w-6')
    expect(el.querySelector('[data-index]')?.parentElement?.className).toContain('gap-0.75')
  })

  test('without axisLabels it is an image with no tab stop; with them keys move the lit bar', () => {
    const { unmount } = render(<MiniBars points={[1, 2, 3]} label="Shipped" height={40} />)
    expect(screen.getByRole('img', { name: 'Shipped' }).getAttribute('tabindex')).toBe('-1')
    unmount()
    const view = render(
      <MiniBars points={[1, 2, 3]} label="Shipped" height={72} axisLabels={['a', 'b', 'c']} />,
    )
    const host = screen.getByRole('group', { name: 'Shipped' })
    expect(host.getAttribute('aria-roledescription')).toBe('chart')
    expect(lit(view.container)).toEqual([2])
    fireEvent.keyDown(host, { key: 'Home' })
    expect(lit(view.container)).toEqual([0])
    expect(view.container.querySelector('[data-slot="spark-live"]')?.textContent).toBe('#1: 1')
    fireEvent.keyDown(host, { key: 'End' })
    expect(lit(view.container)).toEqual([2])
  })

  test('a bar above the cap is held at the top under a caret', () => {
    const el = dom(<MiniBars points={[1, 2, 40]} label="S" height={40} cap={4} />)
    expect(el.querySelectorAll('[data-slot="spark-caret"]')).toHaveLength(1)
    expect(el.querySelector('[data-index="2"] [data-slot="spark-caret"]')).not.toBeNull()
    expect(el.textContent).toContain('max 40')
  })

  test('long series pool to the bar cap', () => {
    const el = dom(
      <MiniBars points={Array.from({ length: 1000 }, (_, i) => i)} label="S" height={40} />,
    )
    expect(bars(el).length).toBeLessThanOrEqual(120)
  })
})
