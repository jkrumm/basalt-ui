/**
 * `persisted` — the keyed contract: frozen stored identity, per-key caching, pluggable storage,
 * and `clearOwner`.
 */
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { StorageLike } from './ports'
import { persisted } from './persisted'

type Memory = StorageLike & { data: Map<string, string>; emit(key: string | null): void }

/** An in-memory backend with a `subscribe`, and no key enumeration unless asked for. */
function memory(o: { enumerable?: boolean } = {}): Memory {
  const data = new Map<string, string>()
  const subs = new Set<(key: string | null) => void>()
  const store: Memory = {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    subscribe: (cb) => {
      subs.add(cb)
      return () => void subs.delete(cb)
    },
    emit: (key) => {
      for (const cb of subs) cb(key)
    },
  }
  if (!o.enumerable) return store
  Object.defineProperty(store, 'length', { get: () => data.size })
  Object.assign(store, { key: (i: number) => [...data.keys()][i] ?? null })
  return store
}

/** There is no "unset"; delegating to the live `window.localStorage` per call is the default again. */
function restoreDefault(): void {
  persisted.setStorage({
    getItem: (k) => window.localStorage.getItem(k),
    setItem: (k, v) => window.localStorage.setItem(k, v),
    removeItem: (k) => window.localStorage.removeItem(k),
    subscribe: (cb) => {
      const handler = (e: StorageEvent): void => cb(e.key)
      window.addEventListener('storage', handler)
      return () => window.removeEventListener('storage', handler)
    },
  })
}

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  restoreDefault()
})

describe('persisted — keyed identity', () => {
  test('the raw key and envelope bytes are frozen', () => {
    const p = persisted('kid-bytes', { version: 3, initial: { a: 1 } })
    p.set({ a: 2 })
    expect(localStorage.getItem('basalt:kid-bytes')).toBe('{"v":3,"value":{"a":2}}')
  })

  test('two definitions with the same version share one store', () => {
    const a = persisted('kid-same', { version: 1, initial: 0 })
    const b = persisted('kid-same', { version: 1, initial: 0 })
    expect(b).toBe(a)
  })

  test('a different version throws in dev', () => {
    persisted('kid-version', { version: 1, initial: 0 })
    expect(() => persisted('kid-version', { version: 2, initial: 0 })).toThrow()
  })

  test('a different version returns the first definition under production', () => {
    const first = persisted('kid-prod', { version: 1, initial: 0 })
    const previous = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      expect(persisted('kid-prod', { version: 2, initial: 0 })).toBe(first)
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = previous
    }
  })

  test('reset removes the key and returns to initial', () => {
    const p = persisted('kid-reset', { version: 1, initial: 'x' })
    p.set('y')
    p.reset()
    expect(localStorage.getItem('basalt:kid-reset')).toBeNull()
    expect(p.get()).toBe('x')
    expect(p.isSet()).toBe(false)
  })

  test('set accepts an updater that receives the current value', () => {
    const p = persisted('kid-updater', { version: 1, initial: 1 })
    p.set((n) => n + 1)
    p.set((n) => n * 10)
    expect(p.get()).toBe(20)
  })
})

describe('persisted — setStorage and the storage option', () => {
  test('setStorage routes reads and writes and wakes subscribers', () => {
    const p = persisted('ss-route', { version: 1, initial: 'dflt' })
    const hook = renderHook(() => p.use())
    const mem = memory()
    mem.setItem('basalt:ss-route', '{"v":1,"value":"from-memory"}')

    act(() => persisted.setStorage(mem))
    expect(hook.result.current[0]).toBe('from-memory')

    act(() => hook.result.current[1]('written'))
    expect(mem.data.get('basalt:ss-route')).toBe('{"v":1,"value":"written"}')
    expect(localStorage.getItem('basalt:ss-route')).toBeNull()
  })

  test('the per-store storage option wins over setStorage', () => {
    const own = memory()
    const p = persisted('ss-own', { version: 1, initial: 0, storage: own })
    persisted.setStorage(memory())
    p.set(5)
    expect(own.data.get('basalt:ss-own')).toBe('{"v":1,"value":5}')
  })

  test('StorageLike.subscribe wakes the matching store only', () => {
    const mem = memory()
    persisted.setStorage(mem)
    const a = persisted('ss-sub-a', { version: 1, initial: 0 })
    const b = persisted('ss-sub-b', { version: 1, initial: 0 })
    let aWakes = 0
    let bWakes = 0
    const offA = a.subscribe(() => (aWakes += 1))
    const offB = b.subscribe(() => (bWakes += 1))

    mem.data.set('basalt:ss-sub-a', '{"v":1,"value":9}')
    mem.emit('basalt:ss-sub-a')
    expect([aWakes, bWakes, a.get()]).toEqual([1, 0, 9])

    mem.emit(null)
    expect([aWakes, bWakes]).toEqual([2, 1])
    offA()
    offB()
  })

  test('unsubscribing the last listener disconnects from the backend', () => {
    const mem = memory()
    persisted.setStorage(mem)
    const p = persisted('ss-detach', { version: 1, initial: 0 })
    let wakes = 0
    const off = p.subscribe(() => (wakes += 1))
    off()
    mem.emit('basalt:ss-detach')
    expect(wakes).toBe(0)
  })
})

describe('persisted — clearOwner', () => {
  test('removes only that owner, under both prefixes', () => {
    const mem = memory({ enumerable: true })
    persisted.setStorage(mem)
    for (const k of ['a:one', 'form:a:draft', 'ab:x', 'b:a:y', 'form:ab:z', 'scheme']) {
      mem.setItem(`basalt:${k}`, '{"v":1,"value":1}')
    }
    persisted.clearOwner('a')
    expect([...mem.data.keys()].toSorted()).toEqual([
      'basalt:ab:x',
      'basalt:b:a:y',
      'basalt:form:ab:z',
      'basalt:scheme',
    ])
  })

  test('enumerates the per-store storages too', () => {
    const own = memory({ enumerable: true })
    own.setItem('basalt:co-own:unregistered', '{"v":1,"value":1}')
    persisted('co-own:x', { version: 1, initial: 0, storage: own })
    persisted.clearOwner('co-own')
    expect(own.data.size).toBe(0)
  })

  test('without enumeration it falls back to the keys of defined stores', () => {
    const mem = memory()
    persisted.setStorage(mem)
    const mine = persisted('fb:mine', { version: 1, initial: 0 })
    const other = persisted('fbx:other', { version: 1, initial: 0 })
    mem.setItem('basalt:fb:unknown', '{"v":1,"value":1}')
    mine.set(1)
    other.set(2)

    persisted.clearOwner('fb')
    expect(mem.data.has('basalt:fb:mine')).toBe(false)
    expect(mem.data.has('basalt:fbx:other')).toBe(true)
    expect(mem.data.has('basalt:fb:unknown')).toBe(true)
  })

  test('subscribers re-render with initial', () => {
    const p = persisted('co-render:flag', { version: 1, initial: 'dflt' })
    p.set('chosen')
    const hook = renderHook(() => p.use())
    expect(hook.result.current[0]).toBe('chosen')

    act(() => persisted.clearOwner('co-render'))
    expect(hook.result.current[0]).toBe('dflt')
    expect(p.isSet()).toBe(false)
  })

  test('drops an in-memory override', () => {
    const p = persisted('co-override:flag', { version: 1, initial: 0, storage: memory() })
    const blocked: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
      removeItem: () => {},
    }
    const q = persisted('co-override:blocked', { version: 1, initial: 0, storage: blocked })
    q.set(4)
    expect(q.get()).toBe(4)
    persisted.clearOwner('co-override')
    expect(q.get()).toBe(0)
    expect(p.get()).toBe(0)
  })
})
