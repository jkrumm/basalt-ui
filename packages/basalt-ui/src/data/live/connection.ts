/**
 * `useConnection`: whether the app is live (push stream up), polling, or offline, from one external
 * store per `QueryClient`. Offline means a CLASSIFIED network failure, never "some query errored":
 * only a fetch `TypeError` or `NetworkError` from a `liveQuery` that is not `external` (or the push
 * channel's own connect) counts, three in a row, held 5 s against flapping. A ZodError, a 4xx/5xx
 * (any response resets the count) and a third-party poll do not. The store never flips Query's
 * `onlineManager`. Nothing runs at import, on the server or before the first subscriber: the
 * server snapshot is one constant and the query cache is read only once a component subscribes.
 * Optional peer: @tanstack/react-query.
 */
import { onlineManager, useQueryClient } from '@tanstack/react-query'
import type { Query, QueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import type { ChannelState, ChannelStore, Scheduler } from '../../core/channel'
import type { ConnectionView } from '../../core/ports'
import { statusOf } from '../query-client'
import { NetworkError } from '../unwrap'
import { liveMetaOf } from './live-query-runtime'

/** Consecutive classified network failures that make the app unreachable. */
export const OFFLINE_AFTER = 3
/** A reachability change is held until this long after the previous one. */
export const HYSTERESIS_MS = 5_000

const SERVER_VIEW: ConnectionView = Object.freeze({
  state: 'polling',
  stream: 'none',
  online: true,
  reachable: true,
})

const DEFAULT_SCHEDULER: Scheduler = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
}

/** A fetch `TypeError` (the browser's offline failure) or the `NetworkError` `unwrap` rethrows it as. */
export const isNetworkFailure = (error: unknown): boolean =>
  error instanceof TypeError || error instanceof NetworkError

type AnyQuery = Query<unknown, Error, unknown, readonly unknown[]>

/** Only a `liveQuery` that is not `external` speaks for the app's own server. */
const speaksForServer = (query: AnyQuery): boolean => {
  const live = liveMetaOf(query.meta)
  return live !== undefined && live.external !== true
}

const newestData = (client: QueryClient): number | undefined => {
  let newest = 0
  for (const query of client.getQueryCache().getAll()) {
    newest = Math.max(newest, query.state.dataUpdatedAt)
  }
  return newest === 0 ? undefined : newest
}

export type ConnectionStore = {
  subscribe(onChange: () => void): () => void
  getSnapshot(): ConnectionView
  getServerSnapshot(): ConnectionView
  /** The push channel's state: its stream status, last frame, and connect failures. */
  feedChannel(state: ChannelState): void
}

/** Internal: the injected clock is for tests. `connectionStoreOf` is the one the hook uses. */
export function createConnectionStore(
  client: QueryClient,
  scheduler: Scheduler = DEFAULT_SCHEDULER,
): ConnectionStore {
  const listeners = new Set<() => void>()
  let detach: (() => void) | undefined

  let online = onlineManager.isOnline()
  let stream: ConnectionView['stream'] = 'none'
  let lastFrameAt: number | undefined
  let lastUpdatedAt = newestData(client)

  let failures = 0
  let attempt = 0
  let desired = true
  let reachable = true
  let flippedAt = Number.NEGATIVE_INFINITY
  let timer: unknown

  const build = (): ConnectionView => {
    const state = !online || !reachable ? 'offline' : stream === 'live' ? 'live' : 'polling'
    return {
      state,
      stream,
      online,
      reachable,
      ...(lastFrameAt !== undefined && { lastFrameAt }),
      ...(lastUpdatedAt !== undefined && { lastUpdatedAt }),
    }
  }

  let view = build()

  const publish = (): void => {
    const next = build()
    const same =
      next.state === view.state &&
      next.stream === view.stream &&
      next.online === view.online &&
      next.reachable === view.reachable &&
      next.lastFrameAt === view.lastFrameAt &&
      next.lastUpdatedAt === view.lastUpdatedAt
    if (same) return
    view = next
    for (const listener of Array.from(listeners)) listener()
  }

  const settle = (): void => {
    if (reachable === desired) return
    const wait = flippedAt + HYSTERESIS_MS - scheduler.now()
    if (wait > 0) {
      timer ??= scheduler.set(() => {
        timer = undefined
        settle()
        publish()
      }, wait)
      return
    }
    reachable = desired
    flippedAt = scheduler.now()
  }

  const respond = (): void => {
    failures = 0
    desired = true
    settle()
  }

  const fail = (): void => {
    failures += 1
    if (failures >= OFFLINE_AFTER) desired = false
    settle()
  }

  /** A response of any status resets the count; a network failure adds one; anything else is neither. */
  const classify = (error: unknown): void => {
    if (statusOf(error) !== undefined) respond()
    else if (isNetworkFailure(error)) fail()
  }

  const onCache = (event: { type: string; query?: unknown; action?: unknown }): void => {
    if (event.type !== 'updated') return
    const query = event.query as AnyQuery
    const action = event.action as { type: string; error?: unknown; manual?: boolean }
    if (action.type === 'success') {
      lastUpdatedAt = Math.max(lastUpdatedAt ?? 0, query.state.dataUpdatedAt)
      if (action.manual !== true && speaksForServer(query)) respond()
    } else if ((action.type === 'error' || action.type === 'failed') && speaksForServer(query)) {
      classify(action.error)
    } else {
      return
    }
    publish()
  }

  const attach = (): (() => void) => {
    const offCache = client.getQueryCache().subscribe(onCache)
    const offOnline = onlineManager.subscribe((value) => {
      online = value
      publish()
    })
    // Catch up with what happened while nobody listened.
    online = onlineManager.isOnline()
    lastUpdatedAt = newestData(client)
    publish()
    return () => {
      offCache()
      offOnline()
      if (timer !== undefined) scheduler.clear(timer)
      timer = undefined
    }
  }

  return {
    subscribe(onChange) {
      listeners.add(onChange)
      if (listeners.size === 1) detach = attach()
      return () => {
        listeners.delete(onChange)
        if (listeners.size > 0) return
        detach?.()
        detach = undefined
      }
    },
    getSnapshot: () => view,
    getServerSnapshot: () => SERVER_VIEW,
    feedChannel(state) {
      stream = state.status
      lastFrameAt = state.lastFrameAt
      if (state.status === 'live' || state.status === 'unauthorized') respond()
      else if (state.status === 'retrying' && state.attempt > attempt) classify(state.error)
      attempt = state.attempt
      publish()
    },
  }
}

const stores = new WeakMap<QueryClient, ConnectionStore>()

/** The one connection store of a client, created on first read (a pure WeakMap get-or-create). */
export function connectionStoreOf(client: QueryClient): ConnectionStore {
  let store = stores.get(client)
  if (!store) {
    store = createConnectionStore(client)
    stores.set(client, store)
  }
  return store
}

/**
 * Feeds a channel's state to its client's connection store: the stream word, the last frame, and
 * the channel's own network connect failures. `bindInvalidation` is to call it from `start()` (not wired yet); returns
 * the unsubscribe. Internal: an app never calls this.
 */
export function attachChannel(
  client: QueryClient,
  channel: { readonly store: ChannelStore<ChannelState> },
): () => void {
  const store = connectionStoreOf(client)
  const feed = (): void => store.feedChannel(channel.store.getSnapshot())
  feed()
  return channel.store.subscribe(feed)
}

/**
 * Whether the app is live, polling or offline, and how old its stream and data are. Feed it to
 * `<ConnectionIndicator connection={...} />`. `offline` is a classified network failure (three in
 * a row, held 5 s) or the browser reporting offline, never a 4xx/5xx, a parse error or a failing
 * third-party (`external`) poll. Needs a client from `makeQueryClient`.
 *
 * @useWhen a live surface shows whether its data is streaming, polling or cut off
 * @neverWhen the app needs to gate a fetch on the network (read the `onlineManager` of Query; this hook never flips it)
 *
 * @example
 * ```tsx
 * <ConnectionIndicator connection={useConnection()} />
 * ```
 */
export function useConnection(): ConnectionView {
  const store = connectionStoreOf(useQueryClient())
  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot)
}
