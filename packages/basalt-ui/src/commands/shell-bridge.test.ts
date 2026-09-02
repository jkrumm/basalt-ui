/**
 * `setColorScheme`/`toggleSidebar` — the pure register/call half. The wiring half (`BasaltProvider`
 * registering the Mantine setter, `BasaltShell` registering the collapse toggle) is covered by
 * `provider/index.test.tsx` and `shell/index.test.tsx`.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import {
  registerColorSchemeSetter,
  registerSidebarToggle,
  setColorScheme,
  toggleSidebar,
} from './shell-bridge'

afterEach(() => {
  registerColorSchemeSetter(null)
  registerSidebarToggle(null)
})

describe('setColorScheme', () => {
  test('a no-op (no throw) when nothing is registered', () => {
    expect(() => setColorScheme('dark')).not.toThrow()
  })

  test('calls the registered setter with the given scheme', () => {
    const received: { scheme: string | null } = { scheme: null }
    registerColorSchemeSetter((scheme) => {
      received.scheme = scheme
    })
    setColorScheme('light')
    expect(received.scheme).toBe('light')
  })

  test('last-registered wins — the same rule defineCommands/defineOverlays document', () => {
    let calls: string[] = []
    registerColorSchemeSetter(() => calls.push('first'))
    registerColorSchemeSetter(() => calls.push('second'))
    setColorScheme('auto')
    expect(calls).toEqual(['second'])
  })

  test('registering null clears the handle', () => {
    let called = false
    registerColorSchemeSetter(() => {
      called = true
    })
    registerColorSchemeSetter(null)
    setColorScheme('dark')
    expect(called).toBe(false)
  })
})

describe('toggleSidebar', () => {
  test('a no-op (no throw) when nothing is registered', () => {
    expect(() => toggleSidebar()).not.toThrow()
  })

  test('calls the registered toggle', () => {
    let calls = 0
    registerSidebarToggle(() => {
      calls++
    })
    toggleSidebar()
    toggleSidebar()
    expect(calls).toBe(2)
  })
})
