/**
 * The origin flag: a change that arrives from another tab updates memory and never schedules a
 * write, so two tabs that both mirror a key cannot echo each other forever.
 */
import { beforeEach, describe, expect, test } from 'bun:test'
import { persisted } from './persisted'
import type { StorageLike } from './ports'

beforeEach(() => {
  localStorage.clear()
})

/** A backend over a map whose `subscribe` is the "another tab wrote" signal, and which counts writes. */
function sharedBackend() {
  const data = new Map<string, string>()
  const subscribers = new Set<(key: string | null) => void>()
  let writes = 0
  const backend: StorageLike = {
    getItem: (k) => data.get(k) ?? null,
    setItem(k, v) {
      writes += 1
      data.set(k, v)
    },
    removeItem: (k) => void data.delete(k),
    subscribe(cb) {
      subscribers.add(cb)
      return () => subscribers.delete(cb)
    },
  }
  return {
    backend,
    writes: () => writes,
    /** Tab B wrote: storage changes under us, then the signal fires. */
    fromOtherTab(key: string, value: unknown, version = 1) {
      data.set(key, JSON.stringify({ v: version, value }))
      for (const cb of subscribers) cb(key)
    },
  }
}

describe('persisted — origin flag', () => {
  test('a subscribe signal from another tab updates memory and schedules no write', () => {
    const shared = sharedBackend()
    const p = persisted('origin-echo', { version: 1, initial: 0, storage: shared.backend })
    // A mirror that reacts to every change by writing the value back: the echo loop.
    const off = p.subscribe(() => p.set(p.get()))

    const before = shared.writes()
    shared.fromOtherTab('basalt:origin-echo', 7)

    expect(p.get()).toBe(7)
    expect(shared.writes()).toBe(before)
    off()
  })

  test('a window storage event does the same on the default backend', () => {
    const p = persisted('origin-window', { version: 1, initial: 0 })
    let writes = 0
    const setItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (this: Storage, k: string, v: string) {
      writes += 1
      setItem.call(this, k, v)
    }
    const off = p.subscribe(() => p.set(p.get()))
    try {
      localStorage.setItem('basalt:origin-window', JSON.stringify({ v: 1, value: 3 }))
      writes = 0
      window.dispatchEvent(new StorageEvent('storage', { key: 'basalt:origin-window' }))
      expect(p.get()).toBe(3)
      expect(writes).toBe(0)
    } finally {
      Storage.prototype.setItem = setItem
      off()
    }
  })

  test('origin() is storage only while listeners run for that change', () => {
    const shared = sharedBackend()
    const p = persisted('origin-flag', { version: 1, initial: 0, storage: shared.backend })
    const seen: string[] = []
    const off = p.subscribe(() => seen.push(p.origin()))

    p.set(1)
    shared.fromOtherTab('basalt:origin-flag', 2)

    expect(seen).toEqual(['local', 'storage'])
    expect(p.origin()).toBe('local')
    off()
  })

  test('a local write after a remote one still persists', () => {
    const shared = sharedBackend()
    const p = persisted('origin-after', { version: 1, initial: 0, storage: shared.backend })
    const off = p.subscribe(() => {})
    shared.fromOtherTab('basalt:origin-after', 5)
    const before = shared.writes()
    p.set(6)
    expect(shared.writes()).toBe(before + 1)
    expect(p.get()).toBe(6)
    off()
  })
})
