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
import { useMemo, useState } from 'react'
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
  /** First-render value, respected only while nothing is persisted. */
  initial: T
}): readonly [T, (next: T) => void] {
  const [local, setLocal] = useState(initial)
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

  if (persistKey !== undefined) return [persisted, setPersisted] as const
  return [local, setLocal] as const
}
