/**
 * createPersistedState — Mantine-free, React-only localStorage primitive.
 *
 * Versioned, Standard-Schema-validated state via useSyncExternalStore. SSR-safe.
 * Cross-tab via the 'storage' event. Keys are namespaced 'basalt:*' so they never
 * collide with the localstorage-theme guard pattern.
 */
import { useSyncExternalStore } from 'react'
import type { StandardSchemaV1 } from './register'

// Shared noop subscribe — passed to useSyncExternalStore on the server so no window access occurs.
const noopSubscribe =
  (_cb: () => void): (() => void) =>
  () => {}

// ── useOnlineStatus ────────────────────────────────────────────────────────────────────────────────

function subscribeOnline(cb: () => void): () => void {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => {
    window.removeEventListener('online', cb)
    window.removeEventListener('offline', cb)
  }
}

const getOnlineSnapshot = (): boolean => navigator.onLine
const getOnlineServerSnapshot = (): boolean => true

// Detect SSR once at module load — mirrors createPersistedState's isServer pattern.
const isOnlineServer = typeof window === 'undefined'

/**
 * Returns `true` when the browser reports an active network connection, `false` otherwise.
 * Backed by `useSyncExternalStore`: subscribes to window `online`/`offline` events.
 * SSR-safe — `getServerSnapshot` returns `true` (optimistic: assume online on the server).
 *
 * @example
 * const isOnline = useOnlineStatus()
 * if (!isOnline) return <OfflineBanner />
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    isOnlineServer ? noopSubscribe : subscribeOnline,
    isOnlineServer ? getOnlineServerSnapshot : getOnlineSnapshot,
    getOnlineServerSnapshot,
  )
}

export type PersistedStateOptions<T> = {
  /** localStorage key (will be namespaced as `basalt:<key>`). */
  readonly key: string
  /** Envelope version — increment when the shape changes. */
  readonly version: number
  /** Value to use when nothing is persisted, after migration fails, or on SSR. */
  readonly initial: T
  /** Migrate a previous-version persisted value forward to the current shape. */
  readonly migrate?: (persisted: unknown, fromVersion: number) => T
  /**
   * Standard-Schema validate the (post-migrate) value. Invalid result OR a Promise (async schema)
   * falls back to `initial` — sync storage can't await, so async validators are treated as invalid.
   */
  readonly schema?: StandardSchemaV1<unknown, T>
}

/** The envelope stored in localStorage: `{ v: number, value: unknown }`. */
type Envelope = { v: number; value: unknown }

function isEnvelope(raw: unknown): raw is Envelope {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    'v' in raw &&
    typeof (raw as Record<string, unknown>)['v'] === 'number' &&
    'value' in raw
  )
}

function readStorage<T>(opts: PersistedStateOptions<T>): T {
  const storageKey = `basalt:${opts.key}`
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (raw === null) return opts.initial

    const parsed: unknown = JSON.parse(raw)
    if (!isEnvelope(parsed)) return opts.initial

    let value: unknown = parsed.value

    if (parsed.v !== opts.version) {
      value = opts.migrate ? opts.migrate(parsed.value, parsed.v) : opts.initial
    }

    if (opts.schema) {
      const result = opts.schema['~standard'].validate(value)
      // Async schema — can't await in sync storage path; fall back to initial
      if (result instanceof Promise) return opts.initial
      if (result.issues !== undefined) return opts.initial
      // Narrowed to SuccessResult<T> — value is T
      return result.value
    }

    return value as T
  } catch {
    return opts.initial
  }
}

function writeStorage<T>(opts: PersistedStateOptions<T>, next: T): void {
  const storageKey = `basalt:${opts.key}`
  try {
    const envelope: Envelope = { v: opts.version, value: next }
    window.localStorage.setItem(storageKey, JSON.stringify(envelope))
  } catch {
    // Silently fail (storage full, private browsing, etc.)
  }
}

/**
 * Versioned, Standard-Schema-validated localStorage state via useSyncExternalStore (no zustand).
 * SSR-safe (getServerSnapshot returns `initial`). Cross-tab via the storage event.
 *
 * Returns a factory hook — call it once per module, then use the returned hook in components.
 * Common case is 3 lines.
 *
 * @example
 * export const useFilterDraft = createPersistedState({ key: 'filters', version: 1, initial: DEFAULT, schema: FilterSchema })
 * // in a component:
 * const [draft, setDraft] = useFilterDraft()
 */
export function createPersistedState<T>(
  opts: PersistedStateOptions<T>,
): () => readonly [T, (next: T) => void] {
  const storageKey = `basalt:${opts.key}`

  const listeners = new Set<() => void>()

  const subscribe = (cb: () => void): (() => void) => {
    listeners.add(cb)

    const onStorage = (e: StorageEvent): void => {
      if (e.key === storageKey) cb()
    }
    window.addEventListener('storage', onStorage)

    return () => {
      listeners.delete(cb)
      window.removeEventListener('storage', onStorage)
    }
  }

  const getSnapshot = (): T => readStorage(opts)
  const getServerSnapshot = (): T => opts.initial

  const setState = (next: T): void => {
    writeStorage(opts, next)
    // Notify in-tab listeners (the 'storage' event only fires in OTHER tabs)
    for (const cb of listeners) cb()
  }

  // Detect SSR once at creation time — the environment doesn't change between renders.
  const isServer = typeof window === 'undefined'

  return function usePersistedState(): readonly [T, (next: T) => void] {
    const value = useSyncExternalStore<T>(
      // SSR guard — subscribe must not reference `window` on the server.
      isServer ? noopSubscribe : subscribe,
      isServer ? getServerSnapshot : getSnapshot,
      getServerSnapshot,
    )

    return [value, setState] as const
  }
}
