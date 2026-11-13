/**
 * `bindInvalidation`: the push-to-refetch policy of a live app. A frame from a `Channel` becomes
 * an invalidation of the `pushed` queries it can alter, debounced in two tiers (lists, then the
 * slower aggregates), with a ceiling so a steady stream cannot starve the refetch.
 *
 * Runtime imports: `./live-query-runtime` (the `pushed` mark and the stream flag). Nothing runs at
 * import or at `bindInvalidation`; the subscription exists between `start()` and the stop it returns.
 * Optional peer: @tanstack/react-query.
 */
import type { Query, QueryClient, QueryKey } from '@tanstack/react-query'
import type { Channel, Delivered, Scheduler } from '../../core/channel'
import { liveMetaOf, setStreamLive } from './live-query-runtime'

/** What a frame (or a gap) can alter: every pushed query, none, one root, several roots, or any key a predicate accepts. */
export type Affects<R extends string = string> =
  | 'all'
  | 'none'
  | R
  | readonly R[]
  | ((key: QueryKey) => boolean)

export type BindInvalidationOptions<F, R extends string> = {
  /** Every root (`queryKey[0]`) frames may touch. A `pushed` query outside it can never refresh: a dev error. */
  roots: readonly R[]
  /** Which queries one frame can alter. A throw counts as `'all'`. `'none'` skips the invalidation. */
  map: (frame: F, env: { event: string; id?: string }) => Affects<R>
  /** What a gap (frames possibly lost) invalidates. Default `'all'`; a cursorless app may pass a predicate. */
  onGap?: Affects<R>
  /** Roots on the slower tier (2 s, ceiling 10 s); every other root is the list tier (250 ms, ceiling 1 s). */
  aggregates?: readonly R[]
  /** An explicit `setQueryData` seam, run for every valid frame before `map`. Return `'none'` from `map` to skip invalidation. */
  patch?: (frame: F, client: QueryClient) => void
  /** The channel's `greeting` event name: the greeting is a connection signal, never a change, and does not reach `patch` or `map`. */
  greeting?: string
  scheduler?: Scheduler
}

export const LIST_DEBOUNCE_MS = 250
export const LIST_MAX_WAIT_MS = 1_000
export const AGGREGATE_DEBOUNCE_MS = 2_000
export const AGGREGATE_MAX_WAIT_MS = 10_000

type AnyQuery = Query<unknown, Error, unknown, QueryKey>
type KeyTest = (key: QueryKey) => boolean

const bound = new WeakMap<QueryClient, object>()

const realScheduler: Scheduler = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
}

/** Trailing debounce with a ceiling: a burst runs once, `ms` after its last call or `maxWait` after its first. */
function tier(run: () => void, ms: number, maxWait: number, sched: Scheduler) {
  let trailing: unknown
  let ceiling: unknown
  let pending = false
  const clear = () => {
    sched.clear(trailing)
    sched.clear(ceiling)
    pending = false
  }
  const fire = () => {
    clear()
    run()
  }
  return {
    call() {
      if (pending) sched.clear(trailing)
      else ceiling = sched.set(fire, maxWait)
      pending = true
      trailing = sched.set(fire, ms)
    },
    cancel() {
      if (pending) clear()
    },
  }
}

const isPushed = (query: AnyQuery): boolean => liveMetaOf(query.meta)?.class === 'pushed'

function toTest<R extends string>(affects: Affects<R>): KeyTest {
  if (affects === 'all') return () => true
  if (affects === 'none') return () => false
  if (typeof affects === 'function') return affects
  const roots = new Set<string>(typeof affects === 'string' ? [affects] : affects)
  return (key) => roots.has(String(key[0]))
}

/**
 * Binds a channel's frames to the cache. `start()` (call it in a root effect) subscribes and
 * returns the stop; it is idempotent, and a QueryClient takes one binding at a time. Only
 * `pushed` queries (see `liveQuery`) are ever invalidated. An unparseable frame, a frame `map`
 * throws on, and a frame no one maps all invalidate every pushed query, never nothing. The first
 * time the stream goes live joins the boot requests (`cancelRefetch: false`); every later
 * live, and every `reset` (a 410 or a cursorless reconnect), is a gap and applies `onGap`.
 * It also tells the live runtime whether the stream is live, which moves `pushed` queries
 * between `fallback` and `safety`. Beat events are the channel's (`beats`) and never reach `map`;
 * pass the channel's `greeting` so the greeting does not reach `map` either.
 * Console wiring (software-factory apps/console; replaces its live.ts, policy.ts and debounce.ts):
 * `createChannel({ url: '/v1/stream', greeting: 'hello', schema })`, then
 * `bindInvalidation(client, channel, { roots: ROOTS, aggregates: ['kpis', 'friction'], greeting: 'hello', map: (change) => BY_KIND[change.kind] ?? 'all' })`,
 * then `useEffect(() => live.start(), [])` in the root.
 *
 * @useWhen an app pushes changes over a channel and queries should refetch from them instead of polling
 * @neverWhen the frame carries the whole entity and a cache write is enough (use `patch` alone and have `map` skip it), or the data is only polled
 *
 * @example
 * ```ts
 * const live = bindInvalidation(client, channel, {
 *   roots: ['needs', 'flow', 'issue', 'kpis', 'friction'],
 *   aggregates: ['kpis', 'friction'],
 *   map: (change) => BY_KIND[change.kind] ?? 'all',
 * })
 * useEffect(() => live.start(), [])
 * ```
 */
export function bindInvalidation<F, R extends string>(
  client: QueryClient,
  channel: Channel<F>,
  o: BindInvalidationOptions<F, R>,
): { start(): () => void } {
  const sched = o.scheduler ?? realScheduler
  const rootSet = new Set<string>(o.roots)
  const aggregateSet = new Set<string>(o.aggregates ?? [])
  const self = {}
  let stopCurrent: (() => void) | undefined

  const checkRoot = (query: AnyQuery): boolean => {
    if (!isPushed(query) || rootSet.has(String(query.queryKey[0]))) return true
    console.error(
      `[basalt] bindInvalidation: pushed query ${JSON.stringify(query.queryKey)} has a root outside \`roots\`; no frame can refresh it`,
    )
    return false
  }

  function start(): () => void {
    if (stopCurrent) return stopCurrent
    const owner = bound.get(client)
    if (owner && owner !== self) {
      throw new Error('bindInvalidation: this QueryClient already has a bound channel')
    }
    if (process.env.NODE_ENV !== 'production') {
      const outside = client
        .getQueryCache()
        .getAll()
        .filter((q) => isPushed(q as AnyQuery) && !rootSet.has(String(q.queryKey[0])))
      if (outside.length > 0) {
        throw new Error(
          `[basalt] bindInvalidation: pushed query ${JSON.stringify(outside[0]!.queryKey)} has a root outside \`roots\`; no frame can refresh it`,
        )
      }
    }
    bound.set(client, self)

    let listTests: KeyTest[] = []
    let aggregateTests: KeyTest[] = []
    const flush = (aggregates: boolean) => {
      const tests = aggregates ? aggregateTests : listTests
      if (aggregates) aggregateTests = []
      else listTests = []
      if (tests.length === 0) return
      void client.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey
          return (
            isPushed(query as AnyQuery) &&
            aggregateSet.has(String(key[0])) === aggregates &&
            tests.some((test) => test(key))
          )
        },
      })
    }
    const lists = tier(() => flush(false), LIST_DEBOUNCE_MS, LIST_MAX_WAIT_MS, sched)
    const aggregates = tier(() => flush(true), AGGREGATE_DEBOUNCE_MS, AGGREGATE_MAX_WAIT_MS, sched)
    const note = (affects: Affects<R>) => {
      const test = toTest(affects)
      listTests.push(test)
      lists.call()
      if (aggregateSet.size === 0) return
      aggregateTests.push(test)
      aggregates.call()
    }

    const resolve = (frame: F, env: { event: string; id?: string }): Affects<R> => {
      try {
        o.patch?.(frame, client)
      } catch (error) {
        console.error('[basalt] bindInvalidation: patch threw', error)
      }
      try {
        return o.map(frame, env)
      } catch (error) {
        console.error(
          '[basalt] bindInvalidation: map threw; invalidating all pushed queries',
          error,
        )
        return 'all'
      }
    }

    const onDelivered = (d: Delivered<F>) => {
      if (d.kind === 'reset') return note(o.onGap ?? 'all')
      if (o.greeting !== undefined && d.event === o.greeting) return
      if (!d.ok) return note('all')
      const env = d.id === undefined ? { event: d.event } : { event: d.event, id: d.id }
      note(resolve(d.value, env))
    }

    let greeted = false
    let live = false
    const onStore = () => {
      const isLive = channel.store.getSnapshot().status === 'live'
      if (isLive === live) return
      live = isLive
      setStreamLive(client, isLive)
      if (!isLive) return
      if (greeted) return note(o.onGap ?? 'all')
      greeted = true
      void client.invalidateQueries(
        { predicate: (q) => isPushed(q as AnyQuery) },
        { cancelRefetch: false },
      )
    }

    const offCache = client.getQueryCache().subscribe((event) => {
      if (event.type === 'added' && process.env.NODE_ENV !== 'production') {
        checkRoot(event.query as AnyQuery)
      }
    })
    const offStore = channel.store.subscribe(onStore)
    const offFrames = channel.subscribe(onDelivered)
    onStore()

    stopCurrent = () => {
      stopCurrent = undefined
      offFrames()
      offStore()
      offCache()
      lists.cancel()
      aggregates.cancel()
      if (live) setStreamLive(client, false)
      bound.delete(client)
    }
    return stopCurrent
  }

  return { start }
}
