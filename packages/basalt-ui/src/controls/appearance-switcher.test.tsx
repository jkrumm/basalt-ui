import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { APPEARANCE_KEY, setAppearance } from '../core/appearance'
import { setScheme } from '../core/scheme'
import { AppearanceSwitcher } from './appearance-switcher'

const root = (): HTMLElement => document.documentElement
const ATTRS = ['data-theme', 'data-density', 'data-frame', 'data-accent']

function reset(): void {
  localStorage.clear()
  for (const a of ATTRS) root().removeAttribute(a)
}

beforeEach(reset)
afterEach(() => {
  cleanup()
  reset()
})

describe('AppearanceSwitcher', () => {
  test('four rows: theme, accent, density, layout, each a named group', () => {
    const { getByRole } = render(<AppearanceSwitcher accents={['blue', 'violet', 'teal']} />)
    for (const name of ['Theme', 'Accent colour', 'Density', 'Layout'])
      expect(getByRole('radiogroup', { name })).toBeTruthy()
  })

  test('picking applies to <html> at once and is stored', () => {
    const { getByRole } = render(<AppearanceSwitcher accents={['blue', 'violet']} />)
    fireEvent.click(getByRole('radio', { name: /Regular/ }))
    fireEvent.click(getByRole('radio', { name: /Edge to edge/ }))
    fireEvent.click(getByRole('radio', { name: 'Violet' }))
    fireEvent.click(getByRole('radio', { name: 'Dark' }))
    expect(ATTRS.map((a) => root().getAttribute(a))).toEqual(['dark', 'normal', 'flush', 'violet'])
    expect(JSON.parse(localStorage.getItem(APPEARANCE_KEY) ?? '{}')).toEqual({
      density: 'normal',
      frame: 'flush',
      accent: 'violet',
    })
  })

  test('picking the base accent or the default density clears the attribute', () => {
    setAppearance({ accent: 'violet', density: 'normal' })
    const { getByRole } = render(<AppearanceSwitcher accents={['blue', 'violet']} />)
    fireEvent.click(getByRole('radio', { name: 'Blue' }))
    fireEvent.click(getByRole('radio', { name: /Compact/ }))
    expect(root().hasAttribute('data-accent')).toBe(false)
    expect(root().hasAttribute('data-density')).toBe(false)
  })

  test('follows a change made elsewhere', async () => {
    const { getByRole } = render(<AppearanceSwitcher accents={['blue', 'teal']} />)
    await act(async () => {
      setAppearance({ accent: 'teal' })
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(getByRole('radio', { name: 'Teal' }).getAttribute('aria-checked')).toBe('true')
  })

  test('the accent row hides when the app ships fewer than two accents', () => {
    const { queryByRole } = render(<AppearanceSwitcher accents={['blue']} />)
    expect(queryByRole('radiogroup', { name: 'Accent colour' })).toBeNull()
  })

  test('rows picks and orders the rows', () => {
    const { getAllByRole } = render(<AppearanceSwitcher rows={['density', 'scheme']} />)
    expect(getAllByRole('radiogroup').map((g) => g.getAttribute('aria-labelledby'))).toHaveLength(2)
  })

  test('reset returns everything to the defaults and is disabled when nothing is chosen', async () => {
    setScheme('dark')
    setAppearance({ density: 'comfortable', frame: 'flush', accent: 'rose' })
    const { getByRole } = render(<AppearanceSwitcher accents={['blue', 'rose']} />)
    const button = getByRole('button', { name: 'Reset appearance' })
    await act(async () => {
      fireEvent.click(button)
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(ATTRS.map((a) => root().hasAttribute(a))).toEqual([false, false, false, false])
    expect(localStorage.getItem(APPEARANCE_KEY)).toBeNull()
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })
})
