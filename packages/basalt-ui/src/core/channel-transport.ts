/**
 * The default `Transport` of `createChannel`: server-sent events over `fetch`, parsed by
 * `eventsource-parser`. Receive-only. A non-2xx answer throws `{ status }` so the channel can tell
 * a lost cursor (410) and a refused token (401/403) from an outage, which the native `EventSource`
 * cannot. Every chunk of bytes, comments and half-events included, yields at least one `beat` so
 * the channel's watchdog counts bytes, not frames.
 *
 * Runtime imports: `eventsource-parser` only. Nothing runs at import.
 */
import { createParser } from 'eventsource-parser'

/** One unit of a stream: a frame, or a byte that carried none (comment, partial event, `beat`). */
export type Wire = { kind: 'frame'; id?: string; event: string; data: string } | { kind: 'beat' }

/** What a transport is handed on every (re)connect. `cursor` is the last frame id, when `resume` is set. */
export type TransportContext = { cursor?: string; signal: AbortSignal }

/** A stream of wires. Throws `{ status }` on an HTTP failure; any other throw is a network failure. */
export type Transport = (c: TransportContext) => AsyncIterable<Wire>

export type FetchTransportOptions = {
  url: string | (() => string)
  headers?: (() => HeadersInit | Promise<HeadersInit>) | undefined
  resume?: 'header' | { param: string } | undefined
}

function withParam(url: string, param: string, value: string): string {
  const hash = url.indexOf('#')
  const base = hash < 0 ? url : url.slice(0, hash)
  const tail = hash < 0 ? '' : url.slice(hash)
  return `${base}${base.includes('?') ? '&' : '?'}${encodeURIComponent(param)}=${encodeURIComponent(value)}${tail}`
}

export function fetchTransport(o: FetchTransportOptions): Transport {
  return async function* ({ cursor, signal }) {
    let url = typeof o.url === 'function' ? o.url() : o.url
    const headers = new Headers(await o.headers?.())
    headers.set('accept', 'text/event-stream')
    if (cursor !== undefined && o.resume === 'header') headers.set('last-event-id', cursor)
    if (cursor !== undefined && typeof o.resume === 'object') {
      url = withParam(url, o.resume.param, cursor)
    }
    const res = await fetch(url, { headers, signal })
    if (!res.ok) {
      void res.body?.cancel().catch(() => {})
      throw { status: res.status }
    }
    if (!res.body) throw { status: 0 }
    const out: Wire[] = []
    const parser = createParser({
      onEvent: (e) =>
        out.push({
          kind: 'frame',
          event: e.event ?? 'message',
          data: e.data,
          ...(e.id === undefined ? {} : { id: e.id }),
        }),
      onComment: () => out.push({ kind: 'beat' }),
    })
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) return
        parser.feed(decoder.decode(value, { stream: true }))
        if (out.length === 0) out.push({ kind: 'beat' })
        yield* out.splice(0)
      }
    } finally {
      void reader.cancel().catch(() => {})
    }
  }
}
