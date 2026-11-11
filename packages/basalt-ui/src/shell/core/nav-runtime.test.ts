import { describe, expect, test } from 'bun:test'
import { createNavRuntime, createNavRuntimeDouble } from './nav-runtime'
import type { NavState } from './nav-runtime'
import type { CoreNavConfig } from './types'

const NAV: CoreNavConfig = {
  sections: [
    {
      id: 's',
      label: 'S',
      items: [
        { id: 'home', label: 'Home' },
        { id: 'a', label: 'A', children: [{ id: 'b', label: 'B' }] },
      ],
    },
  ],
}

/** A stand-in for the router's resolver: the last path segment is the active id. */
const resolve = (pathname: string): NavState => {
  const id = pathname.split('/').filter(Boolean).at(-1) ?? 'home'
  return { activeId: id, ancestorIds: new Set(id === 'b' ? ['a'] : []) }
}

describe('createNavRuntime', () => {
  test('resolves the initial pathname and notifies on a change of the active item only', () => {
    const runtime = createNavRuntime({ nav: NAV, resolve, pathname: '/' })
    expect(runtime.getState().activeId).toBe('home')
    let calls = 0
    const off = runtime.subscribe(() => calls++)
    const before = runtime.getState()
    runtime.setPathname('/x/home')
    expect(runtime.getState()).toBe(before)
    expect(calls).toBe(0)
    runtime.setPathname('/a/b')
    expect(runtime.getState().activeId).toBe('b')
    expect([...runtime.getState().ancestorIds]).toEqual(['a'])
    expect(calls).toBe(1)
    off()
    runtime.setPathname('/a')
    expect(calls).toBe(1)
  })
})

describe('createNavRuntimeDouble', () => {
  test('sets the active item by hand and keeps the snapshot stable when unchanged', () => {
    const runtime = createNavRuntimeDouble(NAV)
    expect(runtime.getState().activeId).toBeUndefined()
    let calls = 0
    runtime.subscribe(() => calls++)
    runtime.setActive('b', ['a'])
    const snapshot = runtime.getState()
    runtime.setActive('b', ['a'])
    expect(runtime.getState()).toBe(snapshot)
    expect(calls).toBe(1)
    runtime.setActive('b', [])
    expect(calls).toBe(2)
    runtime.setActive(undefined)
    expect(runtime.getState().activeId).toBeUndefined()
    expect(runtime.nav).toBe(NAV)
  })
})
