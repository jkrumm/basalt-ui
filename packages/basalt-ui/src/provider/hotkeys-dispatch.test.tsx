/**
 * Real keydown on `document` against basalt's own `useRegistryHotkeys` and the real
 * `@tanstack/react-hotkeys` manager: a bound command runs once and claims the event, a false
 * `when()` leaves the event untouched, and unmount unregisters.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { cleanup, render, waitFor } from '@testing-library/react'
import { detectPlatform, getHotkeyManager } from '@tanstack/react-hotkeys'
import { defineCommands } from '../commands/define-commands'
import { useRegistryHotkeys } from './hotkeys'

function Bound(): null {
  useRegistryHotkeys()
  return null
}

function press(): KeyboardEvent {
  const mac = detectPlatform() === 'mac'
  const event = new KeyboardEvent('keydown', {
    key: 'b',
    code: 'KeyB',
    bubbles: true,
    cancelable: true,
    ...(mac ? { metaKey: true } : { ctrlKey: true }),
  })
  document.dispatchEvent(event)
  return event
}

afterEach(cleanup)

describe('useRegistryHotkeys dispatch', () => {
  test('Mod+B runs once, honours when(), unregisters on unmount', async () => {
    let runs = 0
    let enabled = true
    defineCommands({
      'sidebar:toggle': {
        label: 'Toggle sidebar',
        shortcut: 'Mod+B',
        when: () => enabled,
        run: () => {
          runs += 1
        },
      },
    })
    const view = render(<Bound />)
    // The peer binds through a lazy import(); wait for the registration without pressing anything.
    await waitFor(() => {
      expect(getHotkeyManager().registrations.state.size).toBeGreaterThan(0)
    })
    const before = runs

    enabled = false
    expect(press().defaultPrevented).toBe(false)
    expect(runs).toBe(before)

    enabled = true
    expect(press().defaultPrevented).toBe(true)
    expect(runs).toBe(before + 1)

    view.unmount()
    expect(press().defaultPrevented).toBe(false)
    expect(runs).toBe(before + 1)
  })
})
