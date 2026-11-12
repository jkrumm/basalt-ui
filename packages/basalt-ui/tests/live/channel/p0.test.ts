/**
 * P0 fixtures (live-realtime 7) on both transports: the fetch transport against a real SSE server
 * and a test-only native `EventSource` adapter. A difference between them is fixed in the
 * transport, never in the assertion.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { createChannel } from '../../../src/core/channel'
import type { Delivered, Envelope, Transport } from '../../../src/core/channel'
import { EPOS_AFTER_RESET, EPOS_STREAM } from './fixtures/epos'
import { ROLLHOOK_LOG, isDone } from './fixtures/rollhook'
import { SHUTTERFLOW_EVENTS, SHUTTERFLOW_FIRST } from './fixtures/shutterflow'
import { fakeScheduler, flush, nativeTransport, serve } from './support'

const cleanups: (() => void)[] = []
afterEach(() => {
  for (const c of cleanups.splice(0)) c()
})

type Kind = {
  name: 'fetch' | 'native'
  /** Options that point a channel at `url`. */
  wire: (url: string, events: readonly string[]) => { url: string } | { transport: Transport }
}
const kinds: Kind[] = [
  { name: 'fetch', wire: (url) => ({ url }) },
  { name: 'native', wire: (url, events) => ({ transport: nativeTransport(url, events) }) },
]

const until = async (ok: () => boolean) => {
  for (let i = 0; i < 200 && !ok(); i++) await new Promise((r) => setTimeout(r, 10))
  expect(ok()).toBe(true)
}

describe.each(kinds)('P0 fixtures on the $name transport', (kind) => {
  test('shutterflow: five named events, named heartbeat never delivered, no ids', async () => {
    const s = serve(() => ({ chunks: SHUTTERFLOW_FIRST, hold: true }))
    cleanups.push(s.stop)
    const events = [...SHUTTERFLOW_EVENTS, 'heartbeat']
    const channel = createChannel({
      ...kind.wire(s.url, events),
      beats: ['heartbeat'],
      scheduler: fakeScheduler(),
    })
    const got: Delivered<Envelope>[] = []
    cleanups.push(channel.subscribe((d) => got.push(d)))
    await until(() => got.length >= SHUTTERFLOW_EVENTS.length)
    expect(got.map((d) => (d.kind === 'frame' ? d.event : d.kind))).toEqual([...SHUTTERFLOW_EVENTS])
    expect(got.every((d) => d.kind === 'frame' && d.id === undefined)).toBe(true)
    expect(channel.store.getSnapshot().status).toBe('live')
  })

  test('shutterflow: silent lag keeps the channel live and delivers nothing', async () => {
    const beatOnly = 'event: heartbeat\ndata: {}\n\n'
    const s = serve(() => ({ chunks: [beatOnly, beatOnly, beatOnly], hold: true }))
    cleanups.push(s.stop)
    const channel = createChannel({
      ...kind.wire(s.url, ['heartbeat']),
      beats: ['heartbeat'],
      scheduler: fakeScheduler(),
    })
    const got: Delivered<Envelope>[] = []
    cleanups.push(channel.subscribe((d) => got.push(d)))
    await until(() => channel.store.getSnapshot().status === 'live')
    await flush(5)
    expect(got).toEqual([])
    expect(channel.store.getSnapshot().lastFrameAt).toBeUndefined()
    expect(channel.store.getSnapshot().lastByteAt).toBeDefined()
  })

  test('rollhook: [DONE] ends, delivers the lines before it, and never reconnects', async () => {
    const s = serve(() => ({ chunks: ROLLHOOK_LOG }))
    cleanups.push(s.stop)
    const channel = createChannel({
      ...kind.wire(s.url, ['message']),
      end: isDone,
      scheduler: fakeScheduler(),
    })
    const lines: unknown[] = []
    cleanups.push(channel.subscribe((d) => d.kind === 'frame' && d.ok && lines.push(d.value.data)))
    await until(() => channel.store.getSnapshot().status === 'done')
    await flush(5)
    expect(lines).toEqual(['step 1', 'step 2'])
    expect(s.requests).toHaveLength(1)
  })

  test('epos: a named end event ends the stream', async () => {
    const s = serve(() => ({ chunks: EPOS_STREAM }))
    cleanups.push(s.stop)
    const channel = createChannel<Envelope>({
      ...kind.wire(s.url, ['message', 'end']),
      resume: 'header',
      end: 'end',
      scheduler: fakeScheduler(),
    })
    const ids: (string | undefined)[] = []
    cleanups.push(channel.subscribe((d) => d.kind === 'frame' && ids.push(d.id)))
    await until(() => channel.store.getSnapshot().status === 'done')
    expect(ids).toEqual(['1', '2'])
    expect(s.requests).toHaveLength(1)
  })

  test('epos: a 410 on a held cursor delivers a reset and restarts without the cursor', async () => {
    // first connect streams two frames and drops; the resume answers 410; the third connect has no cursor
    const s = serve(({ n, cursor }) => {
      if (n === 0) return { chunks: EPOS_STREAM.slice(0, 2) }
      if (cursor) return { status: 410 }
      return { chunks: EPOS_AFTER_RESET }
    })
    cleanups.push(s.stop)
    const sched = fakeScheduler()
    const channel = createChannel<Envelope>({
      ...kind.wire(s.url, ['message', 'end']),
      resume: 'header',
      end: 'end',
      scheduler: sched,
    })
    const seen: string[] = []
    cleanups.push(
      channel.subscribe((d) => {
        if (d.kind === 'reset') seen.push(`reset:${d.reason}`)
        else if (d.ok) seen.push(`id:${d.id}`)
      }),
    )
    await until(() => channel.store.getSnapshot().status === 'retrying')
    // the drop is followed by a jittered backoff; the fake clock releases it
    await sched.advance(2_000)
    await until(() => channel.store.getSnapshot().status === 'done')
    expect(seen[0]).toBe('id:1')
    expect(seen[1]).toBe('id:2')
    expect(seen).toContain('reset:expired')
    expect(seen.at(-1)).toBe('id:10')
    expect(s.requests.at(-1)?.cursor).toBeNull()
  })
})

describe('fixtures carry no host, token or personal id', () => {
  const dir = join(import.meta.dir, 'fixtures')
  test.each(readdirSync(dir))('%s', (file) => {
    const text = readFileSync(join(dir, file), 'utf8')
    expect(text).not.toMatch(/https?:\/\//i)
    expect(text).not.toMatch(/\b[\w-]+\.(com|org|net|io|dev|app)\b/i)
    expect(text).not.toMatch(/token|bearer|secret|password|authorization/i)
    expect(text).not.toMatch(/[\w.+-]+@[\w-]+\./)
    expect(text).not.toMatch(/krumm|jkrumm|\biu\b/i)
  })
})
