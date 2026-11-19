/**
 * State cycle 4: the invoices page's live wiring, the way a v3 entry holds it (docs/bind-invalidation.md):
 * one module-level client from `createQueryClient`, one push channel, and the binding
 * `bindInvalidation(queryClient, channel, o)` handed to `BasaltProvider live`. Plus the freshness
 * class of every query: the list and the invoice are pushed, the receivables figure is a ticker.
 */
import { queryOptions } from '@tanstack/react-query'
import { bindInvalidation, createChannel, createQueryClient, liveQuery } from 'basalt-ui/data'
import type { Transport, Wire } from 'basalt-ui/data'
import { invoicesApi } from './invoices-api'
import type { InvoiceQuery } from './invoices-api'

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
  const stop = invoicesApi.subscribe((change) => push({ kind: 'frame', ...change }))
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

const invoicesChannel = createChannel({
  transport: memoryTransport,
  greeting: 'hello',
  heartbeatMs: BEAT_MS,
})

/** The entry's client (a v3 `main.tsx` line), shared by the page's queries and the binding. */
export const queryClient = createQueryClient()

/** The push binding, at module level as `BasaltProvider live` asks: a stable value. */
export const live = bindInvalidation(queryClient, invoicesChannel, {
  roots: ['invoices'],
  greeting: 'hello',
  map: () => 'invoices',
})

/** The list: pushed, so a frame refetches it; polled every 15 s while the stream is down. */
export const invoicesQuery = (query: InvoiceQuery) =>
  liveQuery(
    queryOptions({ queryKey: ['invoices', 'list', query], queryFn: () => invoicesApi.list(query) }),
    { class: 'pushed', fallback: 15_000, safety: 120_000 },
  )

export const invoiceQuery = (id: string) =>
  liveQuery(
    queryOptions({ queryKey: ['invoices', 'one', id], queryFn: () => invoicesApi.get(id) }),
    { class: 'pushed', fallback: 15_000, safety: 120_000 },
  )

/** The receivables figure: nothing pushes it, so it ticks every 5 s. */
const RECEIVABLES_MS = 5_000
export const receivablesQuery = () =>
  liveQuery(
    queryOptions({ queryKey: ['invoices', 'receivables'], queryFn: () => invoicesApi.stats() }),
    { class: 'ticker', every: RECEIVABLES_MS },
  )
