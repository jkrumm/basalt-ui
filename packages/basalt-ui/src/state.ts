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
 * @deprecated Use `useConnectivity()` from `basalt-ui` instead — it aggregates browser,
 *   React Query, SSE, and health-ping signals into a richer `{ status, details }` object.
 *   `useOnlineStatus` remains for simple boolean needs without a provider dependency.
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

/** Parse a raw localStorage string (or null) into a value, falling back to `initial` on any miss. */
function parseStorage<T>(raw: string | null, opts: PersistedStateOptions<T>): T {
  if (raw === null) return opts.initial
  try {
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

  // One Set of subscriber callbacks — mirrors notifications/store.ts single-listener-to-Set pattern.
  const listeners = new Set<() => void>()

  // ONE module-scoped 'storage' event listener per key, registered lazily on first subscriber.
  // Removed when the last subscriber unsubscribes (cleanup semantics preserved).
  let storageHandler: ((e: StorageEvent) => void) | null = null

  const subscribe = (cb: () => void): (() => void) => {
    listeners.add(cb)

    // Attach the shared window listener on the first subscriber.
    if (storageHandler === null) {
      storageHandler = (e: StorageEvent): void => {
        if (e.key === storageKey) {
          for (const listener of listeners) listener()
        }
      }
      window.addEventListener('storage', storageHandler)
    }

    return () => {
      listeners.delete(cb)
      // Detach the shared window listener when the last subscriber unsubscribes.
      if (listeners.size === 0 && storageHandler !== null) {
        window.removeEventListener('storage', storageHandler)
        storageHandler = null
      }
    }
  }

  // Snapshot cache — useSyncExternalStore requires getSnapshot to return a referentially STABLE
  // value while the store is unchanged. parseStorage() allocates a fresh object/array on every
  // call, so returning it raw makes React see an ever-changing snapshot for object/array state
  // and loop until "Maximum update depth exceeded". We cache the parsed value keyed on the raw
  // localStorage string: same string → same reference; a write (this tab or another) changes the
  // string, so the next read re-parses exactly once. Primitive state was unaffected — this fixes
  // the object/array case (chat history, form drafts).
  let cachedRaw: string | null = null
  let cachedValue: T = opts.initial
  let primed = false

  const getSnapshot = (): T => {
    let raw: string | null
    try {
      raw = window.localStorage.getItem(storageKey)
    } catch {
      raw = null
    }
    if (primed && raw === cachedRaw) return cachedValue
    cachedRaw = raw
    cachedValue = parseStorage(raw, opts)
    primed = true
    return cachedValue
  }
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
