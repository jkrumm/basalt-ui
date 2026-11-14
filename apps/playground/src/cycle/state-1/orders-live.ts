/**
 * State cycle 1: the orders page's live wiring. One QueryClient, one push channel bound to the
 * cache, and the list query's freshness class.
 */
import { queryOptions } from '@tanstack/react-query'
import { createChannel } from 'basalt-ui'
import type { Transport, Wire } from 'basalt-ui'
import { bindInvalidation, liveQuery, makeQueryClient } from 'basalt-ui/data'
import { ordersApi } from './orders-api'
import type { OrderQuery } from './orders-api'

// cycle-state-1: state-1.1 — the router's client (createBasaltRouter) comes from the 2.x
// `makeQueryClient`, which installs no live runtime, so every `liveQuery` fetch on it throws. The page
// builds its own client from `basalt-ui/data` and provides it below the router.
export const ordersClient = makeQueryClient()

const idle = (): void => {}

/** A beat inside the channel's 45 s watchdog, so a quiet feed is never read as a dead one. */
const BEAT_MS = 10_000

/**
 * The stand-in push feed as a `Transport`: the server's changes as frames, a beat every 10 s, and a
 * network failure when the browser goes offline (thrown, so the channel reconnects with backoff).
 */
const memoryTransport: Transport = async function* ({ signal }) {
  if (!navigator.onLine) throw new TypeError('Failed to fetch')
  const queue: (Wire | { failure: unknown })[] = []
  let wake = idle
  const push = (item: Wire | { failure: unknown }): void => {
    queue.push(item)
    wake()
  }
  const stop = ordersApi.subscribe((change) => push({ kind: 'frame', ...change }))
  const beat = setInterval(() => push({ kind: 'beat' }), BEAT_MS)
  const drop = (): void => push({ failure: new TypeError('Failed to fetch') })
  window.addEventListener('offline', drop)
  signal.addEventListener('abort', () => push({ failure: new DOMException('aborted') }), {
    once: true,
  })
  try {
    push({ kind: 'frame', event: 'hello', data: '{}' })
    for (;;) {
      while (queue.length === 0) await new Promise<void>((resolve) => (wake = resolve))
      const item = queue.shift()!
      if ('failure' in item) throw item.failure
      yield item
    }
  } finally {
    stop()
    clearInterval(beat)
    window.removeEventListener('offline', drop)
  }
}

// cycle-state-1: state-1.12 — `createChannel` ships only on the root barrel (the 2.x entry), while the
// binding it feeds is on `basalt-ui/data`.
export const ordersChannel = createChannel({
  transport: memoryTransport,
  greeting: 'hello',
  heartbeatMs: BEAT_MS,
})

export const ordersLive = bindInvalidation(ordersClient, ordersChannel, {
  roots: ['orders'],
  greeting: 'hello',
  map: () => 'orders',
})

/** The list: pushed, so a frame refetches it; polled every 15 s while the stream is down. */
export const ordersQuery = (query: OrderQuery) =>
  liveQuery(
    queryOptions({ queryKey: ['orders', 'list', query], queryFn: () => ordersApi.list(query) }),
    { class: 'pushed', fallback: 15_000, safety: 120_000 },
  )

export const orderQuery = (id: string) =>
  liveQuery(queryOptions({ queryKey: ['orders', 'one', id], queryFn: () => ordersApi.get(id) }), {
    class: 'pushed',
    fallback: 15_000,
    safety: 120_000,
  })
