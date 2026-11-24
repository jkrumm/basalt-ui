import { act, cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { useRef } from 'react'
import { isTextField, useKeyboardInset } from './keyboard'

afterEach(cleanup)

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 5))

/** A `matchMedia` whose only live query is the coarse pointer. */
function pointer(coarse: boolean): void {
  window.matchMedia = ((query: string) => ({
    matches: coarse && query === '(pointer: coarse)',
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia
}

function Host() {
  const ref = useRef<HTMLDivElement | null>(null)
  useKeyboardInset(ref)
  return (
    <div ref={ref} data-testid="host">
      <input aria-label="Name" />
      <input type="checkbox" aria-label="Agree" />
      <input readOnly aria-label="Fixed" />
    </div>
  )
}

const host = (): HTMLElement => document.querySelector<HTMLElement>('[data-testid="host"]')!
const focus = async (label: string): Promise<void> => {
  await act(async () => {
    document.querySelector<HTMLElement>(`[aria-label="${label}"]`)!.focus()
    await tick()
  })
}

describe('isTextField', () => {
  test('a writable text input, a textarea and an editable region raise a keyboard; the rest do not', () => {
    const make = (html: string): Element => {
      const div = document.createElement('div')
      div.innerHTML = html
      return div.firstElementChild!
    }
    expect(isTextField(make('<input type="email">'))).toBe(true)
    expect(isTextField(make('<textarea></textarea>'))).toBe(true)
    expect(isTextField(make('<input type="checkbox">'))).toBe(false)
    expect(isTextField(make('<input type="range">'))).toBe(false)
    expect(isTextField(make('<input readonly>'))).toBe(false)
    expect(isTextField(make('<button></button>'))).toBe(false)
    expect(isTextField(null)).toBe(false)
  })
})

describe('useKeyboardInset', () => {
  let visual: unknown
  beforeEach(() => {
    visual = window.visualViewport
  })
  afterEach(() => {
    Object.defineProperty(window, 'visualViewport', { value: visual, configurable: true })
  })

  test('a coarse pointer: focus in a text field sets data-keyboard, blur clears it', async () => {
    pointer(true)
    render(<Host />)
    expect(host().hasAttribute('data-keyboard')).toBe(false)
    await focus('Name')
    expect(host().hasAttribute('data-keyboard')).toBe(true)
    await act(async () => {
      ;(document.activeElement as HTMLElement).blur()
      await tick()
    })
    expect(host().hasAttribute('data-keyboard')).toBe(false)
  })

  test('a checkbox or a read-only input raises no keyboard', async () => {
    pointer(true)
    render(<Host />)
    await focus('Agree')
    expect(host().hasAttribute('data-keyboard')).toBe(false)
    await focus('Fixed')
    expect(host().hasAttribute('data-keyboard')).toBe(false)
  })

  test('a fine pointer never sets it', async () => {
    pointer(false)
    render(<Host />)
    await focus('Name')
    expect(host().hasAttribute('data-keyboard')).toBe(false)
    expect(host().style.getPropertyValue('--basalt-keyboard-inset')).toBe('0px')
  })

  test('the inset is what the visual viewport leaves of the layout viewport', async () => {
    Object.defineProperty(window, 'visualViewport', {
      value: {
        height: document.documentElement.clientHeight - 300,
        offsetTop: 0,
        addEventListener: () => {},
        removeEventListener: () => {},
      },
      configurable: true,
    })
    pointer(true)
    render(<Host />)
    await focus('Name')
    expect(host().style.getPropertyValue('--basalt-keyboard-inset')).toBe('300px')
  })
})
