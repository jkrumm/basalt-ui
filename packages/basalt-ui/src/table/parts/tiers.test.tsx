/**
 * `revealFocus`: a focused control that sits partly past the sideways scrollport is brought fully in,
 * measured against the scroll padding; a pinned control stays where it is. Layout is faked, since
 * jsdom has none; the real walk is the quality matrix's `/table` cell at 390.
 */
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { revealFocus } from './tiers'

afterEach(cleanup)

function box(left: number, right: number): DOMRect {
  return {
    left,
    right,
    top: 0,
    bottom: 20,
    width: right - left,
    height: 20,
    x: left,
    y: 0,
  } as DOMRect
}

function Port({ pinned = false }: { pinned?: boolean }): ReactElement {
  return (
    <div data-slot="table-root" onFocus={revealFocus}>
      <div data-slot="table-scroller" data-testid="port" style={{ scrollPaddingLeft: '100px' }}>
        <span data-pin={pinned ? 'start' : undefined}>
          <button type="button">go</button>
        </span>
      </div>
    </div>
  )
}

function setup(rect: DOMRect, pinned = false): { port: HTMLElement; button: HTMLElement } {
  const view = render(<Port pinned={pinned} />)
  const port = view.getByTestId('port')
  const button = view.getByRole('button')
  Object.defineProperty(port, 'scrollWidth', { value: 600, configurable: true })
  Object.defineProperty(port, 'clientWidth', { value: 300, configurable: true })
  port.getBoundingClientRect = () => box(0, 300)
  button.getBoundingClientRect = () => rect
  return { port, button }
}

describe('revealFocus', () => {
  test('scrolls a control that is partly past the end edge in, leaving room for its ring', () => {
    const { port, button } = setup(box(250, 340))
    fireEvent.focus(button)
    expect(port.scrollLeft).toBe(44)
  })

  test('scrolls back a control that is under the scroll padding', () => {
    const { port, button } = setup(box(60, 120))
    port.scrollLeft = 80
    fireEvent.focus(button)
    expect(port.scrollLeft).toBe(80 - 44)
  })

  test('leaves a control that is fully in view', () => {
    const { port, button } = setup(box(150, 240))
    fireEvent.focus(button)
    expect(port.scrollLeft).toBe(0)
  })

  test('leaves a pinned control, which is in place', () => {
    const { port, button } = setup(box(250, 340), true)
    fireEvent.focus(button)
    expect(port.scrollLeft).toBe(0)
  })
})
