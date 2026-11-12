/**
 * `liveQuery`: one freshness class per query, declared in the factory, never at the call site.
 * It sets `staleTime`, the focus flags, `meta.basalt.live` and `refetchInterval` as a function of
 * the class. There is no central poller: the P1 spike (docs/v3/spikes/live-poller.md) measured six
 * observers on one key at one fetch per interval on Query 5.104.1 and 5.107.1, because every fetch
 * re-arms every observer's timer in the same instant. Optional peer: @tanstack/react-query.
 */
import type { MutationKey, Query, QueryKey } from '@tanstack/react-query'
import { statusOf } from '../query-client'
import { isLiveClient, isMutationPaused, isStreamLive, liveMetaOf } from './live-query-runtime'
import type { LiveClass, LiveMeta } from './live-query-runtime'

/** What a `ticker` returns when `every` says `false` (idle): staleness falls back to 30 s. */
const IDLE_STALE_MS = 30_000
const STANDARD_STALE_MS = 30_000
/** The least active class wins when observers of one key disagree. */
const RANK: Record<LiveClass, number> = { static: 0, standard: 1, pushed: 2, ticker: 3 }

type AnyQuery = Query<unknown, Error, unknown, QueryKey>
type Cadence = number | ((query: AnyQuery) => number | false)

export type Freshness =
  | 'static'
  | 'standard'
  | { class: 'standard'; onFocus: true }
  | {
      class: 'ticker'
      /** Milliseconds after the previous result; a function returns `false` when idle. */
      every: Cadence
      /** No tick while a mutation with this key is in flight. */
      pauseWhileMutating?: MutationKey
      /** Keep polling in a hidden tab (default: pause, then pull once on becoming visible). */
      background?: true
      /** A third-party source: its failures never count toward Offline. */
      external?: true
    }
  | { class: 'pushed'; fallback: number; safety: number }

/** The shape `liveQuery` reads and returns: any `queryOptions()` result satisfies it. */
export type QueryOptionsLike = {
  queryKey: QueryKey
  queryFn?: unknown
  meta?: Record<string, unknown> | undefined
}

const resolveEvery = (every: Cadence, query: AnyQuery): number | false =>
  typeof every === 'number' ? every : every(query)

const isUnauthorized = (query: AnyQuery): boolean => {
  if (query.state.status !== 'error') return false
  const status = statusOf(query.state.error)
  return status === 401 || status === 403
}

const isEnabled = (enabled: unknown, query: AnyQuery): boolean =>
  (typeof enabled === 'function' ? enabled(query) : enabled) !== false

const warned = new WeakSet<object>()

/** True when an enabled observer of the query carries a less active class than `own`. */
const outranked = (query: AnyQuery, own: LiveClass): boolean => {
  let outranking = false
  for (const observer of query.observers) {
    if (!isEnabled(observer.options.enabled, query)) continue
    const other = liveMetaOf(observer.options.meta)?.class
    if (other === undefined || RANK[other] >= RANK[own]) continue
    outranking = true
  }
  if (outranking && process.env.NODE_ENV !== 'production' && !warned.has(query)) {
    warned.add(query)
    console.warn(
      `[basalt] observers of ${query.queryHash} disagree on freshness class; the least active wins`,
    )
  }
  return outranking
}

/** A tick is skipped (no timer until the next result) for these; hidden and offline are Query's. */
const skipsTimer = (query: AnyQuery, own: LiveClass): boolean =>
  isMutationPaused(query) || isUnauthorized(query) || outranked(query, own)

type Plan = {
  staleTime: unknown
  refetchInterval: unknown
  refetchOnWindowFocus: boolean
  refetchIntervalInBackground?: boolean
  live: Omit<LiveMeta, 'owned'>
}

function planOf(freshness: Freshness): Plan {
  if (freshness === 'static') {
    return {
      staleTime: Infinity,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      live: { class: 'static' },
    }
  }
  if (freshness === 'standard' || freshness.class === 'standard') {
    return {
      staleTime: STANDARD_STALE_MS,
      refetchInterval: false,
      refetchOnWindowFocus: true,
      live: { class: 'standard' },
    }
  }
  if (freshness.class === 'pushed') {
    const { fallback, safety } = freshness
    return {
      staleTime: safety,
      refetchInterval: (query: AnyQuery) =>
        skipsTimer(query, 'pushed') ? false : isStreamLive(query) ? safety : fallback,
      refetchOnWindowFocus: true,
      live: { class: 'pushed' },
    }
  }
  const { every, pauseWhileMutating, background, external } = freshness
  return {
    // A `??` would let `false` through, and Query reads a `false` staleTime as 0.
    staleTime: (query: AnyQuery) => {
      const cadence = resolveEvery(every, query)
      return cadence === false ? IDLE_STALE_MS : cadence
    },
    refetchInterval: (query: AnyQuery) =>
      skipsTimer(query, 'ticker') ? false : resolveEvery(every, query),
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: background === true,
    live: {
      class: 'ticker',
      ...(external && { external }),
      ...(pauseWhileMutating && { pauseWhileMutating }),
    },
  }
}

/** Dev only: a `liveQuery` fetched on a client `makeQueryClient` did not build, or overridden. */
function withDevAsserts(options: QueryOptionsLike): unknown {
  const { queryFn } = options
  if (typeof queryFn !== 'function') return queryFn
  return (context: { client: Parameters<typeof isLiveClient>[0]; queryKey: QueryKey }) => {
    if (!isLiveClient(context.client)) {
      throw new Error(
        `[basalt] liveQuery ${JSON.stringify(context.queryKey)} needs a QueryClient from makeQueryClient`,
      )
    }
    const query = context.client.getQueryCache().find({ queryKey: context.queryKey, exact: true })
    for (const observer of query?.observers ?? []) {
      const live = liveMetaOf(observer.options.meta)
      if (!live || warned.has(observer)) continue
      if (
        observer.options.staleTime !== live.owned.staleTime ||
        observer.options.refetchInterval !== live.owned.refetchInterval
      ) {
        warned.add(observer)
        console.warn(
          `[basalt] an observer of ${JSON.stringify(context.queryKey)} overrides staleTime or refetchInterval set by its liveQuery class`,
        )
      }
    }
    return queryFn(context)
  }
}

/**
 * Gives a query its freshness class: `staleTime`, focus refetch, `meta.basalt.live` and a
 * function-form `refetchInterval` follow the class, so no component sets a cadence. `'static'` is
 * `staleTime: Infinity`, never the string `'static'` (that makes the query immune to invalidation).
 * A ticker runs `every` after the previous result, skips while hidden (unless `background`),
 * offline, mutating (`pauseWhileMutating`) or after a 401/403, and a function `every` returning
 * `false` means idle (staleness 30 s, not 0). Needs a client from `makeQueryClient`.
 *
 * @useWhen a query is polled, pushed, cross-device or static and its cadence belongs in the factory, not the component
 * @neverWhen an observer would set its own `staleTime` or `refetchInterval`; the class owns both
 *
 * @example
 * ```ts
 * export const gym = () =>
 *   liveQuery(queryOptions({ queryKey: ['gym'], queryFn }), { class: 'ticker', every: 5_000 })
 * ```
 */
export function liveQuery<T extends QueryOptionsLike>(options: T, freshness: Freshness): T {
  const plan = planOf(freshness)
  if (
    process.env.NODE_ENV !== 'production' &&
    ('staleTime' in options || 'refetchInterval' in options)
  ) {
    throw new Error(
      `[basalt] liveQuery ${JSON.stringify(options.queryKey)} already sets staleTime or refetchInterval; the freshness class owns both`,
    )
  }
  const owned = { staleTime: plan.staleTime, refetchInterval: plan.refetchInterval }
  const basalt = options.meta?.['basalt']
  const next = {
    ...options,
    staleTime: plan.staleTime,
    refetchInterval: plan.refetchInterval,
    refetchOnWindowFocus: plan.refetchOnWindowFocus,
    ...(plan.refetchIntervalInBackground !== undefined && {
      refetchIntervalInBackground: plan.refetchIntervalInBackground,
    }),
    meta: {
      ...options.meta,
      basalt: {
        ...(typeof basalt === 'object' ? basalt : undefined),
        live: { ...plan.live, owned },
      },
    },
    ...(process.env.NODE_ENV !== 'production' && { queryFn: withDevAsserts(options) }),
  }
  return next as T
}
