/**
 * Test kit for the channel suites: a fake scheduler (the only clock a channel has), a hand-driven
 * transport (`controlled`), a scripted SSE server for the fetch transport, and a spec-shaped
 * `EventSource` over fetch for the native-adapter path (Bun ships none).
 */
import { createParser } from 'eventsource-parser'
import type { Scheduler, Transport, Wire } from '../../../src/core/channel'

// ---- scheduler -----------------------------------------------------------------------------

export type FakeScheduler = Scheduler & {
  /** Every `set` delay, in call order. */
  delays: number[]
  /** Move the clock forward and fire what falls due, in order. */
  advance(ms: number): Promise<void>
  /** Move the clock without firing a timer: a frozen or throttled background tab. */
  freeze(ms: number): void
}

/** Let the promise chains inside a channel run. */
export const flush = async (turns = 12): Promise<void> => {
  for (let i = 0; i < turns; i++) await new Promise<void>((r) => setTimeout(r, 0))
}

export function fakeScheduler(start = 1_000_000): FakeScheduler {
  let now = start
  let seq = 0
  const timers = new Map<number, { at: number; fn: () => void }>()
  const delays: number[] = []
  return {
    delays,
    now: () => now,
    set(fn, ms) {
      delays.push(ms)
      const id = ++seq
      timers.set(id, { at: now + ms, fn })
      return id
    },
    clear(h) {
      timers.delete(h as number)
    },
    async advance(ms) {
      const target = now + ms
      for (;;) {
        const due = [...timers.entries()]
          .filter(([, t]) => t.at <= target)
          .toSorted((a, b) => a[1].at - b[1].at)[0]
        if (!due) break
        timers.delete(due[0])
        now = Math.max(now, due[1].at)
        due[1].fn()
        await flush(4)
      }
      now = target
      await flush(4)
    },
    freeze(ms) {
      now += ms
    },
  }
}

// ---- hand-driven transport -----------------------------------------------------------------

export type Conn = {
  cursor: string | undefined
  signal: AbortSignal
  /** How many times the channel pulled from this connection. */
  pulls: number
  push(...w: Wire[]): void
  frame(event: string, data: string, id?: string): void
  fail(e: unknown): void
  close(): void
}

export function controlled(onConnect?: (c: Conn) => void) {
  const conns: Conn[] = []
  const transport: Transport = ({ cursor, signal }) => ({
    [Symbol.asyncIterator]() {
      const queue: Wire[] = []
      let wake: (() => void) | undefined
      let failure: { e: unknown } | undefined
      let closed = false
      const conn: Conn = {
        cursor,
        signal,
        pulls: 0,
        push: (...w) => {
          queue.push(...w)
          wake?.()
        },
        frame: (event, data, id) =>
          conn.push({ kind: 'frame', event, data, ...(id === undefined ? {} : { id }) }),
        fail: (e) => {
          failure = { e }
          wake?.()
        },
        close: () => {
          closed = true
          wake?.()
        },
      }
      conns.push(conn)
      signal.addEventListener('abort', () => wake?.(), { once: true })
      onConnect?.(conn)
      return {
        async next() {
          conn.pulls++
          for (;;) {
            if (signal.aborted) throw new DOMException('aborted', 'AbortError')
            if (queue.length > 0) return { done: false, value: queue.shift()! }
            if (failure) throw failure.e
            if (closed) return { done: true, value: undefined }
            await new Promise<void>((r) => (wake = r))
          }
        },
      }
    },
  })
  return { transport, conns }
}

// ---- scripted SSE server (fetch transport) -------------------------------------------------

export type Reply = { status: number } | { chunks: string[]; hold?: boolean }

/**
 * A scripted SSE endpoint installed as `globalThis.fetch`. The unit loop runs under a happy-dom
 * preload that replaces `fetch`, so a real socket is not available there; the transport under test
 * still gets a real `Response` with a streaming body, status and request headers.
 */
export function serve(handler: (req: { n: number; cursor: string | null; url: URL }) => Reply) {
  let n = 0
  const requests: { cursor: string | null; headers: Headers }[] = []
  const realFetch = globalThis.fetch
  globalThis.fetch = (async (
    input: unknown,
    init?: { headers?: HeadersInit; signal?: AbortSignal },
  ) => {
    const url = new URL(String(input), 'http://mock.invalid')
    const headers = new Headers(init?.headers)
    const cursor = headers.get('last-event-id') ?? url.searchParams.get('since')
    requests.push({ cursor, headers })
    const reply = handler({ n: n++, cursor, url })
    if ('status' in reply) return new Response('no', { status: reply.status })
    const enc = new TextEncoder()
    let timer: ReturnType<typeof setTimeout> | undefined
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timer)
          try {
            controller.error(new DOMException('aborted', 'AbortError'))
          } catch {}
        })
        for (const c of reply.chunks) {
          if (init?.signal?.aborted) return
          controller.enqueue(enc.encode(c))
          await new Promise((r) => (timer = setTimeout(r, 2)))
        }
        if (!reply.hold) controller.close()
      },
    })
    return new Response(stream, { headers: { 'content-type': 'text/event-stream' } })
  }) as unknown as typeof fetch
  return {
    url: '/stream',
    requests,
    stop: () => {
      globalThis.fetch = realFetch
    },
  }
}

// ---- native EventSource adapter (test-only) ------------------------------------------------

type EsListener = (e: { data: string; lastEventId: string; type: string }) => void

/** The slice of the `EventSource` spec the adapter uses, over fetch + the SSE parser. */
export class TestEventSource {
  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  private readonly listeners = new Map<string, EsListener[]>()
  private readonly ac = new AbortController()
  private lastEventId = ''
  constructor(url: string) {
    void this.run(url)
  }
  addEventListener(type: string, l: EsListener) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), l])
  }
  close() {
    this.ac.abort()
  }
  private async run(url: string) {
    try {
      const res = await fetch(url, {
        headers: { accept: 'text/event-stream' },
        signal: this.ac.signal,
      })
      // a non-2xx answer fails the connection with no status: the native API hides it
      if (!res.ok || !res.body) return this.onerror?.()
      this.onopen?.()
      const parser = createParser({
        onEvent: (e) => {
          if (e.id !== undefined) this.lastEventId = e.id
          const type = e.event ?? 'message'
          for (const l of this.listeners.get(type) ?? []) {
            l({ data: e.data, lastEventId: this.lastEventId, type })
          }
        },
      })
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        parser.feed(dec.decode(value, { stream: true }))
      }
      this.onerror?.()
    } catch {
      if (!this.ac.signal.aborted) this.onerror?.()
    }
  }
}

/**
 * `Transport` over an `EventSource`. Native sources see no status (a 410 is just an error before
 * the first frame) and no comments, so: the adapter listens for the named `events`, and a connect
 * that carried a cursor and failed before its first frame is reported as `{ status: 410 }`, which
 * is how a lost cursor starts over (the heuristic every native consumer ends up writing).
 */
export function nativeTransport(url: string, events: readonly string[]): Transport {
  return async function* ({ cursor, signal }) {
    const useCursor = cursor !== undefined
    const es = new TestEventSource(useCursor ? `${url}?since=${encodeURIComponent(cursor)}` : url)
    const queue: (Wire | { status: number | undefined })[] = []
    let wake: (() => void) | undefined
    const push = (w: Wire | { status: number | undefined }) => {
      queue.push(w)
      wake?.()
    }
    let opened = false
    es.onopen = () => {
      opened = true
      push({ kind: 'beat' })
    }
    es.onerror = () => {
      push(!opened && useCursor ? { status: 410 } : { status: undefined })
    }
    for (const type of new Set(['message', ...events])) {
      es.addEventListener(type, (e) =>
        push({
          kind: 'frame',
          event: type,
          data: e.data,
          ...(e.lastEventId ? { id: e.lastEventId } : {}),
        }),
      )
    }
    signal.addEventListener(
      'abort',
      () => {
        es.close()
        wake?.()
      },
      { once: true },
    )
    try {
      for (;;) {
        while (queue.length === 0) {
          if (signal.aborted) return
          await new Promise<void>((r) => (wake = r))
        }
        const next = queue.shift()!
        if (!('kind' in next)) throw next
        yield next
      }
    } finally {
      es.close()
    }
  }
}
