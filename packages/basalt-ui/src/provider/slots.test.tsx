/**
 * "The bundle follows the definitions": Spotlight, the hotkey binder and the modals layer mount only
 * once a `define*` call registered them. Real keydown against the real hotkey manager, real
 * `@mantine/spotlight` store, real `@mantine/modals`.
 */
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { detectPlatform, getHotkeyManager } from '@tanstack/react-hotkeys'
import { spotlight } from '@mantine/spotlight'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { defineCommands } from '../commands/define-commands'
import { defineOverlays, overlays } from '../commands/define-overlays'
import { defineNav } from '../router-tanstack/nav'
import { BasaltProvider } from './index'
import { resetSlots, useSlots } from './slots'
import * as actionsModule from './spotlight-actions'
import { testRouter } from './test-router'

beforeEach(resetSlots)
afterEach(() => {
  cleanup()
  defineCommands({})
  resetSlots()
  spotlight.close()
})

const searchInput = () => document.querySelector('.mantine-Spotlight-search')

async function openPalette(): Promise<Element | null> {
  await act(async () => {
    spotlight.open()
  })
  const input = searchInput()
  await act(async () => {
    spotlight.close()
  })
  return input
}

function press(): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key: 'k',
    code: 'KeyK',
    bubbles: true,
    cancelable: true,
    ...(detectPlatform() === 'mac'
      ? { metaKey: true, shiftKey: true }
      : { ctrlKey: true, shiftKey: true }),
  })
  document.dispatchEvent(event)
  return event
}

describe('provider slots', () => {
  test('a define-free app registers nothing and mounts no Spotlight', async () => {
    const build = spyOn(actionsModule, 'buildSpotlightActions')
    render(<BasaltProvider router={testRouter('bare')} />)
    await screen.findByText('bare')
    function Probe() {
      return <i>{Object.keys(useSlots()).length}</i>
    }
    render(<Probe />)
    expect(screen.getByText('0')).toBeDefined()
    expect(await openPalette()).toBeNull()
    expect(build).not.toHaveBeenCalled()
    build.mockRestore()
  })

  test('defineNav alone mounts Spotlight; spotlight={false} still suppresses it', async () => {
    defineNav({
      groups: [
        { id: 'main', label: 'Main', items: [{ id: 'home', label: 'Home', link: { to: '/' } }] },
      ],
    } as never)
    render(<BasaltProvider router={testRouter('nav')} spotlight={false} />)
    await screen.findByText('nav')
    expect(await openPalette()).toBeNull()
    cleanup()
    render(<BasaltProvider router={testRouter('nav2')} />)
    await screen.findByText('nav2')
    expect(await openPalette()).not.toBeNull()
  })

  test('defineCommands with a shortcut mounts Spotlight and binds the shortcut', async () => {
    let runs = 0
    defineCommands({
      'file:save': { label: 'Save', shortcut: 'Mod+Shift+K', run: () => void runs++ },
    })
    render(<BasaltProvider router={testRouter('cmd')} />)
    await screen.findByText('cmd')
    expect(await openPalette()).not.toBeNull()
    await waitFor(() => expect(getHotkeyManager().registrations.state.size).toBeGreaterThan(0))
    expect(press().defaultPrevented).toBe(true)
    expect(runs).toBe(1)
  })

  test('a defineCommands without shortcuts registers no hotkey binder', () => {
    defineCommands({ 'a:b': { label: 'A', run: () => {} } })
    function Probe() {
      const slots = useSlots()
      return <i>{Object.keys(slots).sort().join(',')}</i>
    }
    render(<Probe />)
    expect(screen.getByText('spotlight')).toBeDefined()
  })

  test('overlays.confirm works with the sibling ModalsProvider, defined after first render', async () => {
    render(<BasaltProvider router={testRouter('late')} />)
    await screen.findByText('late')
    await act(async () => {
      defineOverlays({})
    })
    const answer = overlays.confirm({ title: 'Sure?', onConfirm: () => {} })
    const confirmButton = await screen.findByText('Confirm')
    await act(async () => {
      confirmButton.click()
    })
    expect(await answer).toBe(true)
  })
})
