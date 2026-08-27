/**
 * createPersistedState — Mantine-free, React-only localStorage primitive.
 *
 * Versioned, Standard-Schema-validated state via useSyncExternalStore. SSR-safe.
 * Cross-tab via the 'storage' event. Keys are namespaced 'basalt:*' so they never
 * collide with the localstorage-theme guard pattern.
 *
 * One of the two halves behind the `basalt-ui/state` barrel (`../state.ts`); the field vocabulary
 * and the two store factories built on this primitive live in `./fields`.
 */
import { useSyncExternalStore } from 'react'
import type { StandardSchemaV1 } from '../register'

// Shared noop subscribe — passed to useSyncExternalStore on the server so no window access occurs.
const noopSubscribe =
  (_cb: () => void): (() => void) =>
  () => {}

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

/**
 * Every subscriber for ONE storage key, shared by every `createPersistedState` instance over that
 * key — plus the single `storage` event listener the key needs.
 *
 * Module-level rather than per-instance because two instances of the same key are ordinary, not a
 * mistake: a page's `createSearchStore` and a widget's `createPersistedState` legitimately name the
 * same key, and a consumer re-exporting a store from two modules ends up there by accident. With
 * per-instance listener sets a write through one instance updated localStorage and notified only
 * its own hooks, so the other instance's components kept rendering the stale value until something
 * else re-rendered them — in the SAME tab, while the cross-tab path (the `storage` event) worked.
 *
 * The map is keyed by the NAMESPACED key and holds no window reference; a channel is created on
 * first subscribe, which only happens in the browser (`subscribe` is never passed on the server).
 */
type KeyChannel = {
  readonly listeners: Set<() => void>
  handler: ((e: StorageEvent) => void) | null
}

const channels = new Map<string, KeyChannel>()

/** Wake every hook on a key, whichever instance holds it. */
function notify(storageKey: string): void {
  const channel = channels.get(storageKey)
  if (channel === undefined) return
  for (const listener of channel.listeners) listener()
}

function channelFor(storageKey: string): KeyChannel {
  const existing = channels.get(storageKey)
  if (existing !== undefined) return existing
  const created: KeyChannel = { listeners: new Set(), handler: null }
  channels.set(storageKey, created)
  return created
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

function writeEnvelope(storageKey: string, version: number, value: unknown): void {
  try {
    const envelope: Envelope = { v: version, value }
    window.localStorage.setItem(storageKey, JSON.stringify(envelope))
  } catch {
    // Silently fail (storage full, private browsing, etc.)
  }
}

function writeStorage<T>(opts: PersistedStateOptions<T>, next: T): void {
  writeEnvelope(`basalt:${opts.key}`, opts.version, next)
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

  const subscribe = (cb: () => void): (() => void) => {
    // The subscriber set is the KEY's, not this instance's — see `KeyChannel`.
    const channel = channelFor(storageKey)
    channel.listeners.add(cb)

    // ONE 'storage' event listener per key, registered lazily on the first subscriber and removed
    // when the last one leaves (cleanup semantics preserved).
    if (channel.handler === null) {
      channel.handler = (e: StorageEvent): void => {
        if (e.key === storageKey) notify(storageKey)
      }
      window.addEventListener('storage', channel.handler)
    }

    return () => {
      channel.listeners.delete(cb)
      if (channel.listeners.size === 0 && channel.handler !== null) {
        window.removeEventListener('storage', channel.handler)
        channel.handler = null
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
    // Notify every in-tab listener on this KEY — the 'storage' event fires in OTHER tabs only, and
    // a second instance of the same key has its own hooks to wake.
    notify(storageKey)
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

// ── readPersistedValue — plain function, no React required ─────────────────────────────────

/**
 * Read a value previously written by `createPersistedState` under the namespaced key
 * `basalt:<key>`. Parses the versioned envelope shape `{ v, value }`. Returns `null` on
 * miss, corruption, version mismatch, or SSR — no fallback is applied (call sites supply
 * their own default).
 *
 * Primary use: `validateSearch` in TanStack Router (which runs outside React, so it can't
 * call `usePersistedState`). Combine with a URL-param check to create a search-param store
 * backed by localStorage.
 *
 * @param key  — un-namespaced key (the same one passed to `createPersistedState`)
 * @param version — if provided, the envelope version must match; stale envelopes return `null`
 *
 * @example
 * const stored = readPersistedValue('dashboard-range', 1)
 * // stored is '1d' | '7d' | '30d' | null
 */
export function readPersistedValue(key: string, version?: number): unknown | null {
  const storageKey = `basalt:${key}`
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw === null) return null
    const envelope: unknown = JSON.parse(raw)
    if (!isEnvelope(envelope)) return null
    if (version !== undefined && envelope.v !== version) return null
    return envelope.value
  } catch {
    return null
  }
}

/**
 * Write a value under the namespaced key `basalt:<key>` in the same versioned envelope
 * `createPersistedState` writes, and wake every hook on that key — the write half of
 * `readPersistedValue`, and plain in the same way: no React required.
 *
 * The one call site is a store field's `clear()`, which has to DELETE its key from the store's
 * record from an event handler, where the hook's setter is not in reach. Not exported from the
 * `basalt-ui/state` barrel: the two store factories are the API, this is their seam.
 *
 * @internal
 */
export function writePersistedValue(key: string, version: number, value: unknown): void {
  const storageKey = `basalt:${key}`
  writeEnvelope(storageKey, version, value)
  notify(storageKey)
}
