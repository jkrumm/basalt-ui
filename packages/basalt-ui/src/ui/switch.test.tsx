import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Switch, switchParts } from './switch'

afterEach(cleanup)

describe('switch module', () => {
  test('renders with no provider; the root carries data-slot and switchParts lists it', () => {
    const { container } = render(<Switch aria-label="Notifications" />)
    const slots = [...container.querySelectorAll('[data-slot]')].map((el) =>
      el.getAttribute('data-slot'),
    )
    expect(slots).toEqual([...switchParts])
    expect(container.querySelector('[role="switch"]')?.getAttribute('data-slot')).toBe('switch')
  })

  test('server render keeps the slot', () => {
    expect(renderToString(<Switch aria-label="On" />)).toContain('data-slot="switch"')
  })

  test('Space toggles it and reports the next value', () => {
    const seen: boolean[] = []
    const { getByRole } = render(
      <Switch aria-label="On" onCheckedChange={(next) => seen.push(next)} />,
    )
    const el = getByRole('switch')
    expect(el.getAttribute('aria-checked')).toBe('false')
    el.focus()
    fireEvent.keyDown(el, { key: ' ' })
    fireEvent.keyUp(el, { key: ' ' })
    expect(seen).toEqual([true])
    expect(el.getAttribute('aria-checked')).toBe('true')
  })

  test('a click toggles it and a disabled switch ignores one', () => {
    const seen: boolean[] = []
    const { getByRole, rerender } = render(
      <Switch aria-label="On" onCheckedChange={(next) => seen.push(next)} />,
    )
    fireEvent.click(getByRole('switch'))
    rerender(<Switch aria-label="On" disabled onCheckedChange={(next) => seen.push(next)} />)
    fireEvent.click(getByRole('switch'))
    expect(seen).toEqual([true])
  })
})
