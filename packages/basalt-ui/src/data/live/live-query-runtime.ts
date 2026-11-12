/**
 * The per-client live runtime behind `liveQuery`: which QueryClients were built by
 * `makeQueryClient`, and the two flags a function-form `refetchInterval` cannot read for itself
 * (Query hands it the `Query`, never the client): a mutation is in flight (`pauseWhileMutating`) and
 * the push stream is live (`pushed`). The flags live in WeakSets keyed by `Query`; when one changes
 * the runtime nudges the query's observers so Query re-evaluates the interval. No timer, no
 * subscription outside the client's own caches, nothing runs at import (SSR-safe).
 */
import type { MutationKey, Query, QueryClient } from '@tanstack/react-query'

export type LiveClass = 'static' | 'standard' | 'pushed' | 'ticker'

/** What `liveQuery` writes to `meta.basalt.live`; the runtime and the dev asserts read it back. */
export type LiveMeta = {
  class: LiveClass
  external?: true
  pauseWhileMutating?: MutationKey
  /** The `staleTime` and `refetchInterval` the class set, so an observer override is detectable. */
  owned: { staleTime: unknown; refetchInterval: unknown }
}

type Runtime = { streamLive: boolean }
type AnyQuery = Query<unknown, Error, unknown, readonly unknown[]>

const runtimes = new WeakMap<QueryClient, Runtime>()
const mutationPaused = new WeakSet<object>()
const streamLive = new WeakSet<object>()

/** `meta.basalt.live` of a meta object, or undefined for a query that is not a liveQuery. */
export function liveMetaOf(meta: unknown): LiveMeta | undefined {
  if (typeof meta !== 'object' || meta === null || !('basalt' in meta)) return undefined
  const { basalt } = meta
  if (typeof basalt !== 'object' || basalt === null || !('live' in basalt)) return undefined
  return basalt.live as LiveMeta
}

export const isLiveClient = (client: QueryClient): boolean => runtimes.has(client)

/** A mutation with the query's `pauseWhileMutating` key is in flight: the query has no timer. */
export const isMutationPaused = (query: object): boolean => mutationPaused.has(query)

/** The push stream is live for this client: a `pushed` query polls at `safety`, not `fallback`. */
export const isStreamLive = (query: object): boolean => streamLive.has(query)

const toggle = (set: WeakSet<object>, query: object, on: boolean): boolean => {
  if (set.has(query) === on) return false
  if (on) set.add(query)
  else set.delete(query)
  return true
}

/** `setOptions` with the options an observer already has re-runs `refetchInterval`, nothing else. */
const nudge = (query: AnyQuery): void => {
  for (const observer of query.observers) observer.setOptions(observer.options)
}

const refresh = (client: QueryClient, runtime: Runtime, query: AnyQuery): void => {
  const live = liveMetaOf(query.meta)
  if (!live) return
  let changed = false
  if (live.pauseWhileMutating) {
    const mutating = client.isMutating({ mutationKey: live.pauseWhileMutating }) > 0
    changed = toggle(mutationPaused, query, mutating)
  }
  if (live.class === 'pushed') changed = toggle(streamLive, query, runtime.streamLive) || changed
  if (changed) nudge(query)
}

/**
 * Marks `client` as live-capable. Idempotent. `makeQueryClient` calls it; a bare `new QueryClient()`
 * never does, which is what the dev assert in `liveQuery` catches.
 */
export function installLiveRuntime(client: QueryClient): void {
  if (runtimes.has(client)) return
  const runtime: Runtime = { streamLive: false }
  runtimes.set(client, runtime)
  const queries = client.getQueryCache()
  queries.subscribe((event) => {
    if (event.type === 'added') refresh(client, runtime, event.query as AnyQuery)
  })
  client.getMutationCache().subscribe((event) => {
    if (event.type !== 'updated') return
    for (const query of queries.getAll()) refresh(client, runtime, query as AnyQuery)
  })
}

/**
 * Tells the runtime whether the push stream is live. The channel binding calls it on every status
 * change; every `pushed` query re-arms at once.
 */
export function setStreamLive(client: QueryClient, live: boolean): void {
  const runtime = runtimes.get(client)
  if (!runtime || runtime.streamLive === live) return
  runtime.streamLive = live
  for (const query of client.getQueryCache().getAll()) refresh(client, runtime, query as AnyQuery)
}
