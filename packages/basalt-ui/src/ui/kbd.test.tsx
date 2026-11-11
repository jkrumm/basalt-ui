import { act, cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Kbd, kbdParts } from './kbd'

afterEach(cleanup)

const withPlatform = (userAgent: string, run: () => void): void => {
  const original = Object.getOwnPropertyDescriptor(window.navigator, 'userAgent')
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true })
  try {
    run()
  } finally {
    if (original) Object.defineProperty(window.navigator, 'userAgent', original)
    else Reflect.deleteProperty(window.navigator, 'userAgent')
  }
}

describe('kbd module', () => {
  test('renders a kbd element with data-slot and kbdParts lists it', () => {
    const { container } = render(<Kbd>K</Kbd>)
    const el = container.firstElementChild as HTMLElement
    expect(el.tagName).toBe('KBD')
    expect([el.getAttribute('data-slot')]).toEqual([...kbdParts])
    expect(el.textContent).toBe('K')
  })

  test('the server render prints Ctrl for Mod, so hydration matches everywhere', () => {
    expect(renderToString(<Kbd>Mod</Kbd>)).toContain('Ctrl')
  })

  test('Mod is the command glyph on Apple platforms and Ctrl elsewhere', async () => {
    withPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)', () => {
      const { container } = render(<Kbd>Mod</Kbd>)
      expect(container.textContent).toBe('⌘')
    })
    cleanup()
    withPlatform('Mozilla/5.0 (X11; Linux x86_64)', () => {
      const { container } = render(<Kbd>Mod</Kbd>)
      expect(container.textContent).toBe('Ctrl')
    })
    await act(async () => undefined)
  })

  test('any other key prints as given', () => {
    const { container } = render(<Kbd>Esc</Kbd>)
    expect(container.textContent).toBe('Esc')
  })
})
