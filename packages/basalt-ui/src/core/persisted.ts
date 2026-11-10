/**
 * `persisted` — one keyed, SSR-safe, versioned store over a pluggable `StorageLike`.
 *
 * Stored identity is frozen: the raw key is `basalt:<key>` and the value is
 * `JSON.stringify({ v: version, value })`. Definitions are cached per key, so two modules naming the
 * same key share one store, one set of listeners, and wake each other in the same tab.
 *
 * Runtime imports: `react` only. The schema type is structural (Standard Schema compatible) so this
 * file never reaches into the register seam.
 */
import { useSyncExternalStore } from 'react'
import type { StorageLike } from './ports'

/** Standard-Schema-compatible validator, declared structurally. Async results count as invalid. */
export type PersistedSchema<T> = {
  readonly '~standard': {
    validate(
      value: unknown,
    ): { value: T; issues?: undefined } | { issues: readonly unknown[] } | Promise<unknown>
  }
}

export type PersistedOptions<T> = {
  /** Envelope version. Increment when the stored shape changes. */
  version: number
  /** Value used when nothing valid is stored, and on the server. */
  initial: T
  /** Validates the (post-migrate) value. An invalid result or an async schema falls back to `initial`. */
  schema?: PersistedSchema<T>
  /** Carries an older envelope's value forward to the current shape. */
  migrate?: (old: unknown, from: number) => T
  /** Backend for this store. Wins over `persisted.setStorage`. */
  storage?: StorageLike
}

export type Persisted<T> = {
  /** Hook: the value and a setter. Server and hydration render `initial`. */
  use(): readonly [T, (n: T | ((p: T) => T)) => void]
  get(): T
  set(n: T | ((p: T) => T)): void
  subscribe(cb: () => void): () => void
  /** True once a value is written or an accepted one is stored. False for an unset or rejected key. */
  isSet(): boolean
  /** Removes the key from storage and returns the store to `initial`. */
  reset(): void
}

type Envelope = { v: number; value: unknown }

/** A store's bookkeeping, shared by every definition of its key. */
type Entry = {
  readonly nsKey: string
  readonly version: number
  readonly storage: StorageLike | undefined
  readonly listeners: Set<() => void>
  readonly api: Persisted<unknown>
  detach: (() => void) | null
  dropCache(): void
}

const entries = new Map<string, Entry>()

/**
 * Values a write could not persist (storage blocked or full), by namespaced key. An explicit
 * choice then still wins for the session; a successful write, a reset or a storage event for the
 * key drops the entry.
 */
const unpersisted = new Map<string, { value: unknown }>()

let globalStorage: StorageLike | null = null

/** `window.localStorage`, or null on the server or when even reading the getter throws. */
function browserStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

/**
 * The default backend. Resolves `window.localStorage` on every call, so a blocked or swapped
 * storage is picked up and never throws during render. `length` and `key` make it enumerable for
 * `clearOwner`.
 */
const defaultStorage = {
  getItem(key: string): string | null {
    try {
      return browserStorage()?.getItem(key) ?? null
    } catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    const storage = browserStorage()
    if (storage === null) throw new Error('No storage available')
    storage.setItem(key, value)
  },
  removeItem(key: string): void {
    try {
      browserStorage()?.removeItem(key)
    } catch {
      // Nothing to remove from a blocked storage.
    }
  },
  get length(): number {
    try {
      return browserStorage()?.length ?? 0
    } catch {
      return 0
    }
  },
  key(index: number): string | null {
    try {
      return browserStorage()?.key(index) ?? null
    } catch {
      return null
    }
  },
}

function backendOf(entry: Entry): StorageLike {
  return entry.storage ?? globalStorage ?? defaultStorage
}

function notify(entry: Entry): void {
  for (const listener of entry.listeners) listener()
}

/** A storage event or `subscribe` callback for this key: another writer is newer than any override. */
function wake(entry: Entry): void {
  unpersisted.delete(entry.nsKey)
  notify(entry)
}

/** Connects the key's channel to the backend's change signal. At most one connection per key. */
function attach(entry: Entry): void {
  const backend = backendOf(entry)
  if (backend === defaultStorage) {
    if (typeof window === 'undefined') return
    const handler = (e: StorageEvent): void => {
      if (e.key !== null && e.key !== entry.nsKey) return
      wake(entry)
    }
    window.addEventListener('storage', handler)
    entry.detach = () => window.removeEventListener('storage', handler)
    return
  }
  entry.detach =
    backend.subscribe?.((key) => {
      if (key !== null && key !== entry.nsKey) return
      wake(entry)
    }) ?? null
}

function detach(entry: Entry): void {
  const off = entry.detach
  entry.detach = null
  off?.()
}

function isEnvelope(raw: unknown): raw is Envelope {
  if (typeof raw !== 'object' || raw === null) return false
  return typeof (raw as Record<string, unknown>)['v'] === 'number' && 'value' in raw
}

/**
 * One parse pass over a raw string: the value, and whether the store ACCEPTED what it found.
 * `accepted` is false for a miss, garbage, a wrong version without `migrate`, or a value the schema
 * rejects (async schemas included), so `isSet` never claims a choice that was not honoured.
 */
function parseStorage<T>(
  raw: string | null,
  o: PersistedOptions<T>,
): { value: T; accepted: boolean } {
  const miss = { value: o.initial, accepted: false }
  if (raw === null) return miss
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isEnvelope(parsed)) return miss

    let value: unknown = parsed.value
    if (parsed.v !== o.version) {
      if (!o.migrate) return miss
      value = o.migrate(parsed.value, parsed.v)
    }

    if (!o.schema) return { value: value as T, accepted: true }
    const result = o.schema['~standard'].validate(value)
    if (result instanceof Promise) return miss
    if (result.issues !== undefined) return miss
    return { value: result.value, accepted: true }
  } catch {
    return miss
  }
}

function define<T>(key: string, o: PersistedOptions<T>): Persisted<T> {
  const nsKey = `basalt:${key}`

  // Snapshot cache keyed on the raw string: same string, same reference. useSyncExternalStore
  // needs a stable snapshot, and parseStorage allocates on every call.
  let cachedRaw: string | null = null
  let cachedValue: T = o.initial
  let cachedIsSet = false
  let primed = false

  const entry: Entry = {
    nsKey,
    version: o.version,
    storage: o.storage,
    listeners: new Set(),
    api: undefined as unknown as Persisted<unknown>,
    detach: null,
    dropCache() {
      primed = false
    },
  }

  const readRaw = (): string | null => {
    try {
      return backendOf(entry).getItem(nsKey)
    } catch {
      return null
    }
  }

  const get = (): T => {
    const override = unpersisted.get(nsKey)
    if (override !== undefined) return override.value as T
    const raw = readRaw()
    if (primed && raw === cachedRaw) return cachedValue
    const parsed = parseStorage(raw, o)
    cachedRaw = raw
    cachedValue = parsed.value
    cachedIsSet = parsed.accepted
    primed = true
    return cachedValue
  }

  const isSet = (): boolean => {
    get()
    return unpersisted.has(nsKey) || cachedIsSet
  }

  const set = (n: T | ((p: T) => T)): void => {
    const next = typeof n === 'function' ? (n as (p: T) => T)(get()) : n
    try {
      const envelope: Envelope = { v: o.version, value: next }
      backendOf(entry).setItem(nsKey, JSON.stringify(envelope))
      unpersisted.delete(nsKey)
    } catch {
      unpersisted.set(nsKey, { value: next })
    }
    notify(entry)
  }

  const reset = (): void => {
    unpersisted.delete(nsKey)
    try {
      backendOf(entry).removeItem(nsKey)
    } catch {
      // A blocked storage holds nothing to remove.
    }
    notify(entry)
  }

  const subscribe = (cb: () => void): (() => void) => {
    entry.listeners.add(cb)
    if (entry.detach === null) attach(entry)
    return () => {
      entry.listeners.delete(cb)
      if (entry.listeners.size === 0) detach(entry)
    }
  }

  const getServerSnapshot = (): T => o.initial

  const api: Persisted<T> = {
    use() {
      const value = useSyncExternalStore(subscribe, get, getServerSnapshot)
      return [value, set] as const
    },
    get,
    set,
    subscribe,
    isSet,
    reset,
  }
  ;(entry as { api: Persisted<unknown> }).api = api as Persisted<unknown>
  entries.set(nsKey, entry)
  return api
}

/**
 * Defines (or returns the already defined) store for `key`.
 *
 * A second definition with the same version returns the first store. A different version throws in
 * development; in production the first definition silently wins.
 *
 * @example
 * const rail = persisted('shell:rail', { version: 1, initial: false })
 * const [collapsed, setCollapsed] = rail.use()
 */
export function persisted<T>(key: string, o: PersistedOptions<T>): Persisted<T> {
  const existing = entries.get(`basalt:${key}`)
  if (existing === undefined) return define(key, o)
  if (existing.version !== o.version && process.env.NODE_ENV !== 'production') {
    throw new Error(
      `persisted("${key}") is already defined with version ${existing.version}, not ${o.version}.`,
    )
  }
  return existing.api as Persisted<T>
}

/**
 * Replaces the backend for every store without its own `storage`. Drops snapshot caches and
 * in-memory overrides, re-points cross-tab listeners and wakes every store. Never throws.
 */
persisted.setStorage = function setStorage(s: StorageLike): void {
  globalStorage = s
  for (const entry of entries.values()) {
    if (entry.storage !== undefined) continue
    entry.dropCache()
    unpersisted.delete(entry.nsKey)
    if (entry.listeners.size === 0) continue
    try {
      detach(entry)
      attach(entry)
    } catch {
      // A backend whose subscribe throws only loses its cross-tab path.
    }
  }
  for (const entry of entries.values()) {
    try {
      notify(entry)
    } catch {
      // One failing listener must not keep the others asleep.
    }
  }
}

type Enumerable = { readonly length: number; key(index: number): string | null }

function isEnumerable(backend: StorageLike): backend is StorageLike & Enumerable {
  const candidate = backend as Partial<Enumerable>
  return typeof candidate.length === 'number' && typeof candidate.key === 'function'
}

/**
 * Removes every key of one owner: `basalt:<owner>:*` and `basalt:form:<owner>:*`. Keys that only
 * contain the owner elsewhere (or share a prefix, like `basalt:ab:x` for owner `a`) stay.
 *
 * Enumeration limit: `StorageLike` has no way to list keys. A backend that also exposes the
 * Storage-style `length` and `key(i)` is enumerated in full. Any other backend can only be cleared
 * for the keys of stores defined in this process; keys written by an earlier session and not
 * defined yet survive.
 */
persisted.clearOwner = function clearOwner(owner: string): void {
  const prefixes = [`basalt:${owner}:`, `basalt:form:${owner}:`]
  const matches = (rawKey: string): boolean => prefixes.some((p) => rawKey.startsWith(p))

  const backends = new Set<StorageLike>([globalStorage ?? defaultStorage])
  for (const entry of entries.values()) {
    if (entry.storage !== undefined) backends.add(entry.storage)
  }

  for (const backend of backends) {
    const keys: string[] = []
    if (isEnumerable(backend)) {
      for (let i = 0; i < backend.length; i += 1) {
        const k = backend.key(i)
        if (k !== null && matches(k)) keys.push(k)
      }
    } else {
      for (const entry of entries.values()) {
        if (backendOf(entry) === backend && matches(entry.nsKey)) keys.push(entry.nsKey)
      }
    }
    for (const k of keys) {
      try {
        backend.removeItem(k)
      } catch {
        // Blocked storage: nothing to remove.
      }
    }
  }

  for (const entry of entries.values()) {
    if (!matches(entry.nsKey)) continue
    unpersisted.delete(entry.nsKey)
    entry.dropCache()
    notify(entry)
  }
}
