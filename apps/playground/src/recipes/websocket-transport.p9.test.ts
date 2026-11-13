/**
 * P9 (docs/v3/concepts/live-realtime.md section 7): the websocket-transport recipe against a real
 * `Bun.serve` websocket and `fakeChannel`. The adapter is at most 40 lines, a reconnect carries the
 * cursor, a ping is a beat, a 4401 close never retries and an abort closes the socket.
 */
import { createChannel } from 'basalt-ui'
import type { Channel, Delivered } from 'basalt-ui'
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
// `fakeChannel` is not on the `basalt-ui/testing` subpath yet: read it from source.
import { fakeChannel } from '../../../../packages/basalt-ui/src/testing/fake-channel'
import { webSocketTransport } from './websocket-transport'

type Hold = { cursor: string | null; close(code?: number): void }
type Script = (ws: Hold & { send(m: object): void }) => void

const servers: { stop(force?: boolean): void }[] = []
afterEach(() => {
  for (const server of servers.splice(0)) server.stop(true)
})

/** A websocket server: `script` runs on every connection; `opened` records each connect's cursor. */
function serve(script: Script) {
  const opened: (string | null)[] = []
  let closed = 0
  const server = Bun.serve<{ cursor: string | null }>({
    port: 0,
    fetch(req, srv) {
      const cursor = new URL(req.url).searchParams.get('cursor')
      return srv.upgrade(req, { data: { cursor } })
        ? undefined
        : new Response('no', { status: 400 })
    },
    websocket: {
      open(ws) {
        opened.push(ws.data.cursor)
        script({
          cursor: ws.data.cursor,
          send: (m) => void ws.send(JSON.stringify(m)),
          close: (code) => ws.close(code),
        })
      },
      close() {
        closed += 1
      },
      message() {},
    },
  })
  servers.push(server)
  return {
    url: (cursor?: string) => `ws://localhost:${server.port}/${cursor ? `?cursor=${cursor}` : ''}`,
    opened,
    closed: () => closed,
  }
}

const until = async (ok: () => boolean) => {
  for (let i = 0; i < 300 && !ok(); i++) await new Promise((r) => setTimeout(r, 10))
  expect(ok()).toBe(true)
}

/** Backoff in a millisecond; the 45 s watchdog stays real. */
const quick = {
  set: (fn: () => void, ms: number) => setTimeout(fn, ms < 5_000 ? 1 : ms),
  clear: (h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
}

describe('P9: the websocket-transport recipe', () => {
  test('the adapter is at most 40 lines', () => {
    const source = readFileSync(new URL('./websocket-transport.ts', import.meta.url), 'utf8')
    const start = source.indexOf('export const webSocketTransport')
    const end = source.indexOf('// #endregion')
    expect(start).toBeGreaterThan(0)
    const lines = source.slice(start, end).trimEnd().split('\n').length
    expect(lines).toBeLessThanOrEqual(40)
  })

  test('a reconnect resumes from the last frame id', async () => {
    const s = serve((ws) => {
      if (ws.cursor === null) {
        ws.send({ id: '1', event: 'change', data: { n: 1 } })
        ws.send({ id: '2', event: 'change', data: { n: 2 } })
        ws.close() // 1000: a plain drop, the channel retries
      } else ws.send({ id: '3', event: 'change', data: { n: 3 } })
    })
    const channel = createChannel({
      transport: webSocketTransport(s.url),
      resume: 'header',
      scheduler: quick,
    })
    const got: Delivered<unknown>[] = []
    const stop = channel.subscribe((d) => got.push(d))
    await until(() => got.filter((d) => d.kind === 'frame').length === 3)
    stop()
    expect(s.opened).toEqual([null, '2'])
    expect(got.map((d) => (d.kind === 'frame' ? d.id : d.kind))).toEqual(['1', '2', '3'])
  })

  test('a ping is a beat: it keeps the channel live and delivers no frame', async () => {
    const s = serve((ws) => ws.send({ ping: true }))
    const channel = createChannel({ transport: webSocketTransport(s.url), scheduler: quick })
    const got: Delivered<unknown>[] = []
    const stop = channel.subscribe((d) => got.push(d))
    await until(() => channel.store.getSnapshot().status === 'live')
    expect(channel.store.getSnapshot().lastByteAt).toBeDefined()
    expect(got).toEqual([])
    stop()
  })

  test('a 4401 close is terminal: the channel is unauthorized and never reconnects', async () => {
    const s = serve((ws) => ws.close(4401))
    const channel = createChannel({ transport: webSocketTransport(s.url), scheduler: quick })
    const stop = channel.subscribe(() => {})
    await until(() => channel.store.getSnapshot().status === 'unauthorized')
    await new Promise((r) => setTimeout(r, 150))
    expect(s.opened).toHaveLength(1)
    stop()
  })

  test('an abort closes the socket', async () => {
    const s = serve(() => {})
    const abort = new AbortController()
    const run = webSocketTransport(s.url)({ signal: abort.signal })[Symbol.asyncIterator]()
    const pending = run.next().catch(() => {})
    await until(() => s.opened.length === 1)
    abort.abort()
    await until(() => s.closed() === 1)
    await pending
  })

  test('code that takes a Channel runs on the socket and on fakeChannel', async () => {
    const collect = async (channel: Channel<unknown>, count: number) => {
      const seen: unknown[] = []
      for await (const frame of channel.frames()) {
        seen.push(frame)
        if (seen.length === count) break
      }
      return seen
    }
    const s = serve((ws) => ws.send({ id: '1', event: 'change', data: { n: 1 } }))
    const real = await collect(
      createChannel({ transport: webSocketTransport(s.url), scheduler: quick }),
      1,
    )
    const fake = fakeChannel<unknown>()
    const faked = collect(fake, 1)
    await new Promise((r) => setTimeout(r, 0))
    fake.emit({ event: 'change', id: '1', data: { n: 1 } })
    expect(real).toEqual([{ event: 'change', id: '1', data: { n: 1 } }])
    expect(await faked).toEqual(real)
  })
})
