/**
 * State cycle 2: the tickets page's live wiring. One push channel, the binding options it is bound to
 * the cache with, and the freshness class of every query: the list and the ticket are pushed, the
 * queue figure is a ticker.
 */
import { queryOptions } from '@tanstack/react-query'
import { createChannel, liveQuery } from 'basalt-ui/data'
import type { Transport, Wire } from 'basalt-ui/data'
import { ticketsApi } from './tickets-api'
import type { TicketQuery } from './tickets-api'

const idle = (): void => {}

/** A beat inside the channel's watchdog (3x `heartbeatMs`), so a quiet feed is never read as dead. */
const BEAT_MS = 10_000

/**
 * The stand-in push feed as a `Transport`: the server's changes as frames, a beat every 10 s, and a
 * network failure when the browser goes offline (thrown, so the channel reconnects with backoff).
 * Fixture: a real app passes `url` and gets SSE.
 */
const memoryTransport: Transport = async function* ({ signal }) {
  if (!navigator.onLine) throw new TypeError('Failed to fetch')
  const queue: (Wire | { failure: unknown })[] = []
  let wake = idle
  const push = (item: Wire | { failure: unknown }): void => {
    queue.push(item)
    wake()
  }
  const stop = ticketsApi.subscribe((change) => push({ kind: 'frame', ...change }))
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

export const ticketsChannel = createChannel({
  transport: memoryTransport,
  greeting: 'hello',
  heartbeatMs: BEAT_MS,
})

/** The list: pushed, so a frame refetches it; polled every 15 s while the stream is down. */
export const ticketsQuery = (query: TicketQuery) =>
  liveQuery(
    queryOptions({ queryKey: ['tickets', 'list', query], queryFn: () => ticketsApi.list(query) }),
    { class: 'pushed', fallback: 15_000, safety: 120_000 },
  )

export const ticketQuery = (id: string) =>
  liveQuery(queryOptions({ queryKey: ['tickets', 'one', id], queryFn: () => ticketsApi.get(id) }), {
    class: 'pushed',
    fallback: 15_000,
    safety: 120_000,
  })

/** The queue figure: nothing pushes it, so it ticks every 5 s. */
export const QUEUE_MS = 5_000
export const queueQuery = () =>
  liveQuery(queryOptions({ queryKey: ['tickets', 'queue'], queryFn: () => ticketsApi.stats() }), {
    class: 'ticker',
    every: QUEUE_MS,
  })
