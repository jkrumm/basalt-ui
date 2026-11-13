/**
 * `useFreshness`: how fresh the data behind a page is, and the props of its `RefreshButton`, from
 * the query cache. The view is derived, not stored: a selector over the active queries behind
 * `keys` (every active query when omitted), re-read on cache events and on a 30 s tick while
 * mounted (a query turns stale with no event). The server and hydration snapshot is one constant
 * with no age, so nothing mismatches. Optional peer: @tanstack/react-query.
 */
import { hashKey, useQueryClient } from '@tanstack/react-query'
import type { Query, QueryClient, QueryKey } from '@tanstack/react-query'
import { useCallback, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from 'react'
import type { FreshnessView } from '../../core/ports'

/** How often staleness and the source age are re-read while a component is mounted. */
export const FRESHNESS_TICK_MS = 30_000

export type FreshnessOptions = {
  /** Reads the upstream timestamp (epoch ms) out of the data, for data a third party produced. */
  source?: (data: unknown) => number | undefined
  /** How old that timestamp may be before `source` reads `'stale'`. Without it a present one is `'fresh'`. */
  sourceMaxAge?: number
}

type Core = {
  fetch: FreshnessView['fetch']
  source?: FreshnessView['source']
  syncing: boolean
  lastCompletedAt?: number
  error?: string
}

const NONE: Core = Object.freeze({ fetch: 'none', syncing: false })

type AnyQuery = Query<unknown, Error, unknown, readonly unknown[]>

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : typeof error === 'string' ? error : 'Request failed'

const matched = (client: QueryClient, keys: readonly QueryKey[] | undefined): AnyQuery[] => {
  const cache = client.getQueryCache()
  const all =
    keys === undefined ? cache.getAll() : keys.flatMap((queryKey) => cache.findAll({ queryKey }))
  return [...new Set(all)].filter((query) => query.getObserversCount() > 0) as AnyQuery[]
}

function fetchOf(queries: readonly AnyQuery[]): Core['fetch'] {
  if (queries.length === 0) return 'none'
  if (queries.some((q) => q.state.status === 'error')) return 'error'
  if (queries.some((q) => q.state.fetchStatus === 'paused')) return 'paused'
  if (queries.some((q) => q.isStale())) return 'stale'
  return 'fresh'
}

function sourceOf(queries: readonly AnyQuery[], o: FreshnessOptions, now: number): Core['source'] {
  if (o.source === undefined) return undefined
  const newest = queries
    .filter((q) => q.state.data !== undefined)
    .reduce<AnyQuery | undefined>(
      (best, q) =>
        best === undefined || q.state.dataUpdatedAt > best.state.dataUpdatedAt ? q : best,
      undefined,
    )
  const at = newest === undefined ? undefined : o.source(newest.state.data)
  if (at === undefined || !Number.isFinite(at)) return 'absent'
  return o.sourceMaxAge !== undefined && now - at > o.sourceMaxAge ? 'stale' : 'fresh'
}

function coreOf(
  client: QueryClient,
  keys: readonly QueryKey[] | undefined,
  o: FreshnessOptions,
): Core {
  const queries = matched(client, keys)
  const completed = Math.max(0, ...queries.map((q) => q.state.dataUpdatedAt))
  const failing = queries.find((q) => q.state.status === 'error')
  const source = sourceOf(queries, o, Date.now())
  return {
    fetch: fetchOf(queries),
    syncing: queries.some((q) => q.state.fetchStatus === 'fetching'),
    ...(source !== undefined && { source }),
    ...(completed > 0 && { lastCompletedAt: completed }),
    ...(failing !== undefined && { error: messageOf(failing.state.error) }),
  }
}

const sameCore = (a: Core, b: Core): boolean =>
  a.fetch === b.fetch &&
  a.source === b.source &&
  a.syncing === b.syncing &&
  a.lastCompletedAt === b.lastCompletedAt &&
  a.error === b.error

/**
 * The freshness of the data behind `keys` (every active query when omitted) and the props of a
 * `RefreshButton`: `{...useFreshness().button}`. `fetch` is `error` over `paused` over `stale` over
 * `fresh`, `none` with no active query; `button.onSync` invalidates the keys; `button.error` is
 * the failing query's message. `source` reads an upstream timestamp out of the data (a Garmin
 * sync time) against `sourceMaxAge`. The server render carries no age, so it hydrates cleanly.
 * Needs a client from `makeQueryClient`.
 *
 * @useWhen a page shows how old its data is, or wires a refresh button to the queries it reads
 * @neverWhen the refresh is a server job with its own state (pass the `RefreshButton` its own props)
 *
 * @example
 * ```tsx
 * const freshness = useFreshness([['usage']])
 * <RefreshButton scope="page" {...freshness.button} />
 * ```
 */
export function useFreshness(
  keys?: readonly QueryKey[],
  options: FreshnessOptions = {},
): FreshnessView {
  const client = useQueryClient()
  // Callers pass fresh literals every render, so the store functions below read the keys and options
  // through a ref (set after commit) and resubscribe only when the keys' hash changes: stable
  // functions keep `useSyncExternalStore` from resubscribing on every render.
  const keyHash = keys === undefined ? '' : keys.map((key) => hashKey(key)).join('|')
  const inputs = useRef({ keys, options })
  useLayoutEffect(() => {
    inputs.current = { keys, options }
  })

  const last = useRef<Core>(NONE)
  const subscribe = useCallback(
    (onChange: () => void) => {
      const off = client.getQueryCache().subscribe(onChange)
      const tick = setInterval(onChange, FRESHNESS_TICK_MS)
      return () => {
        off()
        clearInterval(tick)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new key set must resubscribe and re-read
    [client, keyHash],
  )
  const getSnapshot = useCallback((): Core => {
    const next = coreOf(client, inputs.current.keys, inputs.current.options)
    if (sameCore(last.current, next)) return last.current
    last.current = next
    return next
  }, [client])

  const core = useSyncExternalStore(subscribe, getSnapshot, () => NONE)

  const onSync = useCallback((): void => {
    const current = inputs.current.keys
    if (current === undefined) void client.invalidateQueries()
    else for (const queryKey of current) void client.invalidateQueries({ queryKey })
  }, [client])

  return useMemo(() => {
    const { fetch, source, syncing, lastCompletedAt, error } = core
    return {
      fetch,
      ...(source !== undefined && { source }),
      button: {
        syncing,
        onSync,
        ...(lastCompletedAt !== undefined && { lastCompletedAt }),
        ...(error !== undefined && { error }),
      },
    }
  }, [core, onSync])
}
