// A recipe file the playground typecheck compiles; gen-recipes copies the region into the doc.
// #region recipe:storage-adapter
import { persisted } from 'basalt-ui'
import type { StorageLike } from 'basalt-ui'

const SYNCED = ['basalt:shell:rail', 'basalt:shell:folds']

// Preload the server's record before the first render: a StorageLike is synchronous.
export function createServerStorage(initial: Record<string, string>, url: string): StorageLike {
  const cache = new Map(Object.entries(initial))
  const dirty = new Set<string>()
  let flushing: Promise<unknown> = Promise.resolve()

  // One PUT at a time, in order; a failure keeps the keys dirty for the next flush.
  const flush = (): void => {
    const body = Object.fromEntries([...dirty].map((key) => [key, cache.get(key) ?? null]))
    if (Object.keys(body).length === 0) return
    dirty.clear()
    flushing = flushing.then(() =>
      fetch(url, { method: 'PUT', body: JSON.stringify(body), keepalive: true }).catch(() => {
        for (const key of Object.keys(body)) dirty.add(key)
      }),
    )
  }
  addEventListener('pagehide', flush)

  return {
    getItem: (key) => cache.get(key) ?? null,
    setItem(key, value) {
      cache.set(key, value)
      if (!SYNCED.includes(key)) return // whitelist: other keys stay in memory
      dirty.add(key)
      queueMicrotask(flush)
    },
    removeItem(key) {
      cache.delete(key)
      if (SYNCED.includes(key)) dirty.add(key)
    },
  }
}

// Once, before the first read. Last write wins across devices: there is no `rev`.
export function useServerStorage(initial: Record<string, string>): void {
  persisted.setStorage(createServerStorage(initial, '/api/prefs'))
}
// #endregion
