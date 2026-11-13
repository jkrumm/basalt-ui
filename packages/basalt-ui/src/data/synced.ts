/**
 * `createSyncedState`: a preference object a server stores per person, edited on any device. The
 * definition is inert at module scope; the session lives in a `WeakMap<QueryClient, …>` built on
 * the first `use()` (per router, per request, per test). Reads come through a `liveQuery`, writes
 * through one mutation scope per key; the logic sits in `synced-runtime.ts`.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { MutationKey, QueryClient, QueryKey } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { PersistedSchema } from '../core/persisted'
import type { StorageLike } from '../core/ports'
import { liveQuery } from './live/live-query'
import type { Freshness } from './live/live-query'
import { createSyncedSession } from './synced-runtime'
import type {
  Scheduler,
  SyncStatus,
  SyncedRemote,
  SyncedRev,
  SyncedSession,
  SyncedTransport,
} from './synced-runtime'

export type {
  SyncStatus,
  SyncedRemote,
  SyncedRev,
  SyncedSaveInit,
  SyncedTransport,
} from './synced-runtime'

export type SyncedStateOptions<T extends object> = {
  /** Mirror key `basalt:<owner>:<key>`; the Query key and the mutation scope derive from it. */
  key: string
  /** Mirror envelope version. Increment when the stored shape changes. */
  version: number
  /** Validates the mirror. Async results count as invalid. The transport parses server data. */
  schema: PersistedSchema<T>
  initial: T
  /** The signed-in person. `null`: memory only, no load, no save. A switch drops unsent edits. */
  owner: () => string | null
  transport: SyncedTransport<T>
  /** Default `'standard'`. A ticker's `pauseWhileMutating` is set to this state's own saves. */
  freshness?: Freshness
  /** True while a field of this state has focus: a remote value waits until it is false. */
  editing?: () => boolean
  /** Mirror backend. Default `localStorage`. */
  storage?: StorageLike
  debounceMs?: number
}

export type SyncedUse<T> = {
  value: T
  set(patch: Partial<T>): void
  status: SyncStatus
  rev: SyncedRev
}

/** One field as `[value, setValue]`, the shape a `SettingsRow` control takes. */
export type SyncedField<V> = { use(): readonly [V, (next: V) => void] }

export type SyncedState<T extends object> = {
  use(): SyncedUse<T>
  field<K extends keyof T>(k: K): SyncedField<T[K]>
}

const clock: Scheduler = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id as ReturnType<typeof setTimeout>),
}

/** `localStorage`, or null where reading it throws (a blocked or sandboxed frame) or it is absent. */
function deviceStorage(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

/**
 * A preference object the server stores per person and every device edits. `set` shows the value
 * at once, writes a local mirror and saves after `debounceMs` through one serial writer; a 409 or
 * 412 loads, re-applies the unsent patch and retries once; a failed save retries three times, then
 * `status` is `'error'` (`'offline'` without a network) with the patch kept for the next `set`. A
 * hidden tab flushes with `keepalive` when the value fits 64 KiB. A remote value replaces a field
 * only when nothing is pending, `editing()` is false and 2 s passed since that field's last edit.
 * An un-seeded server (`load` answers `value: null`) is seeded once from the mirror. An edit not
 * yet sent when the page crashes or reloads is lost. Needs a client from `makeQueryClient`.
 *
 * @useWhen a preference object follows the person across devices and the server stores it whole or per field
 * @neverWhen the value is device-local (`persisted`), a form draft, or a record list (`optimistic` on a mutation)
 *
 * @example
 * ```ts
 * export const gymPrefs = createSyncedState({
 *   key: 'gym', version: 1, schema: GymPrefs, initial: { unit: 'kg', rest: 90 },
 *   owner: () => session.userId, freshness: { class: 'ticker', every: 5_000 },
 *   transport: {
 *     load: async () => {
 *       const row = unwrap(await api.gym.get())
 *       return { value: row.state, rev: row.updated_at }
 *     },
 *     save: async (patch, base, init) => {
 *       const row = unwrap(await api.gym.put({ ...base.value, ...patch }, init))
 *       return { value: row.state, rev: row.updated_at }
 *     },
 *   },
 * })
 * ```
 */
export function createSyncedState<T extends object>(o: SyncedStateOptions<T>): SyncedState<T> {
  const sessions = new WeakMap<QueryClient, SyncedSession<T>>()
  const queryKeyOf = (owner: string | null): QueryKey => ['basalt', 'synced', o.key, owner]
  const mutationKeyOf = (owner: string | null): MutationKey => ['basalt', 'synced', o.key, owner]

  function freshnessOf(owner: string | null): Freshness {
    const f = o.freshness ?? 'standard'
    if (typeof f === 'object' && f.class === 'ticker') {
      return { ...f, pauseWhileMutating: mutationKeyOf(owner) }
    }
    return f
  }

  function sessionFor(client: QueryClient, owner: string | null): SyncedSession<T> {
    const current = sessions.get(client)
    if (current?.owner === owner) return current
    current?.dispose()
    const queryKey = queryKeyOf(owner)
    const next = createSyncedSession(o, {
      owner,
      storage: o.storage ?? deviceStorage(),
      scheduler: clock,
      remote: client.getQueryData<SyncedRemote<T>>(queryKey),
      write: (run) =>
        client
          .getMutationCache()
          .build(client, {
            mutationKey: mutationKeyOf(owner),
            scope: { id: `basalt:${owner}:${o.key}` },
            mutationFn: run,
            retry: false,
            // The session owns retries and the offline status; a paused mutation never runs.
            networkMode: 'always',
          })
          .execute(undefined),
      onRemote: (remote) => client.setQueryData(queryKey, remote),
    })
    sessions.set(client, next)
    return next
  }

  function use(): SyncedUse<T> {
    const client = useQueryClient()
    const owner = o.owner()
    const session = sessionFor(client, owner)
    useQuery({
      ...liveQuery(
        { queryKey: queryKeyOf(owner), queryFn: () => session.load(), enabled: owner !== null },
        freshnessOf(owner),
      ),
      notifyOnChangeProps: [],
    })
    const snap = useSyncExternalStore(session.subscribe, session.snapshot, session.serverSnapshot)
    return { value: snap.value, status: snap.status, rev: snap.rev, set: session.set }
  }

  const fields = new Map<keyof T, unknown>()
  function field<K extends keyof T>(k: K): SyncedField<T[K]> {
    const cached = fields.get(k) as SyncedField<T[K]> | undefined
    if (cached) return cached
    const made: SyncedField<T[K]> = {
      use() {
        const { value, set } = use()
        return [value[k], (next: T[K]) => set({ [k]: next } as unknown as Partial<T>)] as const
      },
    }
    fields.set(k, made)
    return made
  }

  return { use, field }
}
