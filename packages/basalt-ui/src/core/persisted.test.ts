/**
 * `persisted` — the in-tab notification contract (the keyed `persisted` port of the 2.x
 * `createPersistedState` / `createPersistedStore` suite).
 *
 * The versioned envelope and the cross-tab path are exercised through every store that persists
 * (`fields.test.tsx`, `search-store.test.ts`); what only shows up here is TWO instances over ONE
 * key, which is ordinary rather than exotic: a page's store and a widget's own state legitimately
 * name the same key. Per-instance listener sets made a write through one invisible to the other in
 * the SAME tab — while the cross-tab path worked, which is what made it read as a caching bug.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import { act, renderHook } from '@testing-library/react'
import { persisted } from './persisted'

/** The stored envelope's value, or `undefined` when absent or written under another version. */
function readPersistedValue(key: string, version: number): unknown {
  const raw = localStorage.getItem(`basalt:${key}`)
  if (raw === null) return undefined
  const envelope = JSON.parse(raw) as { v: number; value: unknown }
  return envelope.v === version ? envelope.value : undefined
}

beforeEach(() => {
  localStorage.clear()
})

describe('persisted — one key, two instances', () => {
  test('a write through A re-renders a hook on B with the new value', () => {
    const pA = persisted('shared-draft', { version: 1, initial: 'a' })
    const pB = persisted('shared-draft', { version: 1, initial: 'a' })

    const a = renderHook(() => pA.use())
    const b = renderHook(() => pB.use())
    expect(b.result.current[0]).toBe('a')

    act(() => {
      a.result.current[1]('written-through-A')
    })

    expect(b.result.current[0]).toBe('written-through-A')
    expect(a.result.current[0]).toBe('written-through-A')
    expect(readPersistedValue('shared-draft', 1)).toBe('written-through-A')
  })

  test('the notification is per KEY — a second key is not woken', () => {
    const pShared = persisted('k-one', { version: 1, initial: 0 })
    const pOther = persisted('k-two', { version: 1, initial: 0 })

    let otherRenders = 0
    const shared = renderHook(() => pShared.use())
    renderHook(() => {
      otherRenders += 1
      return pOther.use()
    })
    const before = otherRenders

    act(() => {
      shared.result.current[1](7)
    })

    expect(shared.result.current[0]).toBe(7)
    expect(otherRenders).toBe(before)
  })

  test('unmounting one instance leaves the other subscribed', () => {
    const pA = persisted('shared-unmount', { version: 1, initial: 'a' })
    const pB = persisted('shared-unmount', { version: 1, initial: 'a' })

    const a = renderHook(() => pA.use())
    const b = renderHook(() => pB.use())
    a.unmount()

    const c = renderHook(() => pA.use())
    act(() => {
      c.result.current[1]('later')
    })

    expect(b.result.current[0]).toBe('later')
  })

  test('an object value stays referentially stable between writes (the snapshot cache)', () => {
    const pDraft = persisted<{ title: string }>('shared-object', {
      version: 1,
      initial: { title: '' },
    })

    const { result } = renderHook(() => pDraft.use())
    const first = result.current[0]
    act(() => {
      result.current[1]({ title: 'one' })
    })
    const written = result.current[0]

    expect(first).not.toBe(written)
    expect(written).toEqual({ title: 'one' })
    // Same raw string → same parsed reference, which is what keeps useSyncExternalStore quiet.
    expect(renderHook(() => pDraft.use()).result.current[0]).toBe(written)
  })
})

describe('persisted — unset is not written-false', () => {
  test('isSet is false until a write, then true even when the value equals `initial`', () => {
    const pStore = persisted('unset-flag', { version: 1, initial: false })
    const { result } = renderHook(() => pStore.use())
    expect(result.current[0]).toBe(false)
    expect(pStore.isSet()).toBe(false)

    act(() => {
      result.current[1](false)
    })

    expect(result.current[0]).toBe(false)
    expect(pStore.isSet()).toBe(true)
  })

  test('a value already in storage reads as set; a corrupt one does not', () => {
    const pStore = persisted('unset-flag-2', { version: 1, initial: true })
    localStorage.setItem('basalt:unset-flag-2', JSON.stringify({ v: 1, value: false }))
    const stored = renderHook(() => pStore.use())
    expect(stored.result.current[0]).toBe(false)
    expect(pStore.isSet()).toBe(true)
    stored.unmount()

    localStorage.setItem('basalt:unset-flag-2', 'not json')
    const corrupt = renderHook(() => pStore.use())
    expect(corrupt.result.current[0]).toBe(true)
    expect(pStore.isSet()).toBe(false)
  })

  test('a stale-version envelope is not set, and the value stays `initial`', () => {
    const pStore = persisted('stale-flag', { version: 2, initial: 'dflt' })
    localStorage.setItem('basalt:stale-flag', JSON.stringify({ v: 1, value: 'old' }))
    const { result } = renderHook(() => pStore.use())
    expect(result.current[0]).toBe('dflt')
    expect(pStore.isSet()).toBe(false)
  })

  test('a schema-invalid envelope is not set', () => {
    const schema = {
      '~standard': {
        version: 1 as const,
        vendor: 'test',
        validate: (value: unknown) =>
          typeof value === 'string' ? { value } : { issues: [{ message: 'not a string' }] },
      },
    }
    const pStore = persisted('schema-flag', {
      version: 1,
      initial: 'dflt',
      schema,
    })
    localStorage.setItem('basalt:schema-flag', JSON.stringify({ v: 1, value: 42 }))
    const { result } = renderHook(() => pStore.use())
    expect(result.current[0]).toBe('dflt')
    expect(pStore.isSet()).toBe(false)
  })

  test('a migrated stale envelope counts as set', () => {
    const pStore = persisted('migrated-flag', {
      version: 2,
      initial: 0,
      migrate: (old) => Number(old) * 10,
    })
    localStorage.setItem('basalt:migrated-flag', JSON.stringify({ v: 1, value: 4 }))
    const { result } = renderHook(() => pStore.use())
    expect(result.current[0]).toBe(40)
    expect(pStore.isSet()).toBe(true)
  })

  test('when the write throws, the explicit choice still wins for the session', () => {
    const pStore = persisted('blocked-flag', { version: 1, initial: false })
    const { result } = renderHook(() => pStore.use())
    const real = window.localStorage
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => real.getItem(key),
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
      },
    })
    try {
      act(() => {
        result.current[1](true)
      })
      expect(result.current[0]).toBe(true)
      expect(pStore.isSet()).toBe(true)
      expect(localStorage.getItem('basalt:blocked-flag')).toBeNull()
    } finally {
      Object.defineProperty(window, 'localStorage', { configurable: true, value: real })
    }

    // Storage works again: the next write persists and the override is gone.
    act(() => {
      result.current[1](false)
    })
    expect(localStorage.getItem('basalt:blocked-flag')).toBe(JSON.stringify({ v: 1, value: false }))
    expect(result.current[0]).toBe(false)
  })

  test('removeItem plus a storage event returns the store to unset', () => {
    const pStore = persisted('removed-flag', { version: 1, initial: 'dflt' })
    localStorage.setItem('basalt:removed-flag', JSON.stringify({ v: 1, value: 'chosen' }))
    const { result } = renderHook(() => pStore.use())
    expect(result.current[0]).toBe('chosen')
    expect(pStore.isSet()).toBe(true)

    act(() => {
      localStorage.removeItem('basalt:removed-flag')
      window.dispatchEvent(new StorageEvent('storage', { key: 'basalt:removed-flag' }))
    })

    expect(result.current[0]).toBe('dflt')
    expect(pStore.isSet()).toBe(false)
  })

  test('createPersistedState keeps its two-element contract', () => {
    const pState2 = persisted('two-tuple', { version: 1, initial: 0 })
    expect(renderHook(() => pState2.use()).result.current).toHaveLength(2)
  })
})
