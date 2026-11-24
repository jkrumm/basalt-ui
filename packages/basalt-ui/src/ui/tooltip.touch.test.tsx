import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { Tooltip } from './tooltip'

afterEach(cleanup)

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
const popup = (): Element | null => document.querySelector('[data-slot="tooltip"]')

function touch(
  el: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  at = { x: 5, y: 5 },
) {
  fireEvent(
    el,
    new PointerEvent(type, { pointerType: 'touch', clientX: at.x, clientY: at.y, bubbles: true }),
  )
}

describe('tooltip on touch', () => {
  test('a long press on an icon-only control shows the label and the release does not click', async () => {
    let clicks = 0
    const { getByRole } = render(
      <Tooltip label="Copy link">
        <button type="button" aria-label="Copy link" onClick={() => clicks++}>
          <svg aria-hidden="true" />
        </button>
      </Tooltip>,
    )
    const button = getByRole('button')
    touch(button, 'pointerdown')
    expect(popup()).toBeNull()
    await act(() => sleep(560))
    expect(popup()?.textContent).toBe('Copy link')
    touch(button, 'pointerup')
    fireEvent.click(button)
    expect(clicks).toBe(0)
    fireEvent.click(button)
    expect(clicks).toBe(1)
  })

  test('a control with a visible label does nothing on touch', async () => {
    const { getByRole } = render(
      <Tooltip label="Copy the link to the clipboard">
        <button type="button">Copy</button>
      </Tooltip>,
    )
    touch(getByRole('button'), 'pointerdown')
    await act(() => sleep(560))
    expect(popup()).toBeNull()
  })

  test('an aria-hidden glyph or a screen-reader-only span is not a visible label', async () => {
    const { getByRole } = render(
      <Tooltip label="Close">
        <button type="button">
          <span aria-hidden="true">×</span>
          <span className="sr-only">Close</span>
        </button>
      </Tooltip>,
    )
    touch(getByRole('button'), 'pointerdown')
    await act(() => sleep(560))
    expect(popup()?.textContent).toBe('Close')
  })

  test('a finger that travels is a scroll: no label', async () => {
    const { getByRole } = render(
      <Tooltip label="Copy link">
        <button type="button" aria-label="Copy link" />
      </Tooltip>,
    )
    const button = getByRole('button')
    touch(button, 'pointerdown')
    touch(button, 'pointermove', { x: 5, y: 40 })
    await act(() => sleep(560))
    expect(popup()).toBeNull()
  })

  test('the label leaves again after a few seconds', async () => {
    const { getByRole } = render(
      <Tooltip label="Copy link">
        <button type="button" aria-label="Copy link" />
      </Tooltip>,
    )
    touch(getByRole('button'), 'pointerdown')
    await act(() => sleep(560))
    expect(popup()).not.toBeNull()
    await act(() => sleep(2600))
    expect(popup()).toBeNull()
  })
})
