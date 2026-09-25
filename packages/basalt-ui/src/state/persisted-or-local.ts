/**
 * Internal — one disclosure flag that persists only when the caller named a key.
 *
 * `Section`'s collapse and `PageAside`'s fold are the same hook written twice: an optional
 * `persistKey` decides whether the flag survives a reload, and both a `useState` and a
 * `createPersistedState` hook are ALWAYS called so the hook order is stable across a key appearing
 * or disappearing. Only the branch the caller asked for is returned, so an unpersisted surface
 * never writes to storage.
 *
 * `scope` stays a parameter rather than being folded into `key`: it is what keeps
 * `basalt:section:<key>` and `basalt:aside:<key>` from colliding when two surfaces on one page
 * persist under the same name.
 *
 * Not exported from `../state` — this is an internal hook, not part of the `./state` surface.
 */
import { useCallback, useMemo, useState } from 'react'
import { createPersistedState } from './persisted'

/** The key an unpersisted caller parks on — never read, because that branch returns local state. */
const UNPERSISTED_KEY = '__local__'

export function usePersistedOrLocal<T>({
  scope,
  persistKey,
  initial,
}: {
  /** The storage namespace — `section`, `aside`. Prefixed onto `persistKey`. */
  scope: string
  /** Persist under `basalt:<scope>:<persistKey>`. Omitted → local state, nothing written. */
  persistKey: string | undefined
  /**
   * The value while the user has not chosen one — unset, NOT "written as this". It may change
   * between renders (a size-class default) and the flag follows until a set call pins it.
   */
  initial: T
}): readonly [T, (next: T) => void] {
  // Boxed so "never set" (`null`) stays distinct from a set value of any `T`, falsy ones included.
  const [local, setLocal] = useState<{ value: T } | null>(null)
  // `createPersistedState` is a per-key module FACTORY, so it is memoized rather than called during
  // render — the same reason `shell/index.tsx` memoizes its collapse store.
  const usePersisted = useMemo(
    () =>
      createPersistedState<T>({
        key: `${scope}:${persistKey ?? UNPERSISTED_KEY}`,
        version: 1,
        initial,
      }),
    [scope, persistKey, initial],
  )
  const [persisted, setPersisted] = usePersisted()
  // Stable across renders like the persisted setter — a value-only setter, so no updater form.
  const setLocalValue = useCallback((next: T) => setLocal({ value: next }), [])

  if (persistKey !== undefined) return [persisted, setPersisted] as const
  return [local === null ? initial : local.value, setLocalValue] as const
}
