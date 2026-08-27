/**
 * `createPersistedState` — the in-tab notification contract.
 *
 * The versioned envelope and the cross-tab path are exercised through every store that persists
 * (`fields.test.tsx`, `search-store.test.ts`); what only shows up here is TWO instances over ONE
 * key, which is ordinary rather than exotic: a page's store and a widget's own state legitimately
 * name the same key. Per-instance listener sets made a write through one invisible to the other in
 * the SAME tab — while the cross-tab path worked, which is what made it read as a caching bug.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { createPersistedState, readPersistedValue } from './persisted'

beforeEach(() => {
  localStorage.clear()
})

describe('createPersistedState — one key, two instances', () => {
  test('a write through A re-renders a hook on B with the new value', () => {
    const useA = createPersistedState({ key: 'shared-draft', version: 1, initial: 'a' })
    const useB = createPersistedState({ key: 'shared-draft', version: 1, initial: 'a' })

    const a = renderHook(() => useA())
    const b = renderHook(() => useB())
    expect(b.result.current[0]).toBe('a')

    act(() => {
      a.result.current[1]('written-through-A')
    })

    expect(b.result.current[0]).toBe('written-through-A')
    expect(a.result.current[0]).toBe('written-through-A')
    expect(readPersistedValue('shared-draft', 1)).toBe('written-through-A')
  })

  test('the notification is per KEY — a second key is not woken', () => {
    const useShared = createPersistedState({ key: 'k-one', version: 1, initial: 0 })
    const useOther = createPersistedState({ key: 'k-two', version: 1, initial: 0 })

    let otherRenders = 0
    const shared = renderHook(() => useShared())
    renderHook(() => {
      otherRenders += 1
      return useOther()
    })
    const before = otherRenders

    act(() => {
      shared.result.current[1](7)
    })

    expect(shared.result.current[0]).toBe(7)
    expect(otherRenders).toBe(before)
  })

  test('unmounting one instance leaves the other subscribed', () => {
    const useA = createPersistedState({ key: 'shared-unmount', version: 1, initial: 'a' })
    const useB = createPersistedState({ key: 'shared-unmount', version: 1, initial: 'a' })

    const a = renderHook(() => useA())
    const b = renderHook(() => useB())
    a.unmount()

    const c = renderHook(() => useA())
    act(() => {
      c.result.current[1]('later')
    })

    expect(b.result.current[0]).toBe('later')
  })

  test('an object value stays referentially stable between writes (the snapshot cache)', () => {
    const useDraft = createPersistedState<{ title: string }>({
      key: 'shared-object',
      version: 1,
      initial: { title: '' },
    })

    const { result } = renderHook(() => useDraft())
    const first = result.current[0]
    act(() => {
      result.current[1]({ title: 'one' })
    })
    const written = result.current[0]

    expect(first).not.toBe(written)
    expect(written).toEqual({ title: 'one' })
    // Same raw string → same parsed reference, which is what keeps useSyncExternalStore quiet.
    expect(renderHook(() => useDraft()).result.current[0]).toBe(written)
  })
})
