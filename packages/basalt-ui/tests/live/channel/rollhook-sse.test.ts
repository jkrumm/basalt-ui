/**
 * The rollhook `parseSseChunk` cases (log stream: bare `data:` lines, `[DONE]` ends), ported to
 * `createChannel` on the fetch transport and to `fakeChannel`. The same consumer reads both.
 *
 * One deliberate difference: the parser is spec-faithful, so a bare `data:` line is a frame whose
 * data is the empty string, not a skipped event. The log reader below drops empty lines, which is
 * where rollhook's "no data, no line" rule belongs (a named event with empty data is legitimate).
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { createChannel } from '../../../src/core/channel'
import type { Channel, Envelope } from '../../../src/core/channel'
import { fakeChannel } from '../../../src/testing/fake-channel'
import { fakeScheduler, flush } from './support'

const realFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = realFetch
})

/** The app side: log lines until the stream ends. */
async function readLines(channel: Channel<Envelope>): Promise<string[]> {
  const lines: string[] = []
  for await (const f of channel.frames()) if (f.data !== '') lines.push(String(f.data))
  return lines
}

const isDone = (raw: { data: string }) => raw.data === '[DONE]'

/** A stream that delivers exactly these chunks, then closes. */
function streamOf(chunks: string[]) {
  const enc = new TextEncoder()
  globalThis.fetch = (async () =>
    new Response(
      new ReadableStream({
        async start(c) {
          for (const chunk of chunks) {
            c.enqueue(enc.encode(chunk))
            await new Promise((r) => setTimeout(r, 1))
          }
          c.close()
        },
      }),
      { headers: { 'content-type': 'text/event-stream' } },
    )) as unknown as typeof fetch
}

/** Read lines off a createChannel that is left to retry after the stream closes. */
async function overWire(chunks: string[]) {
  streamOf(chunks)
  const channel = createChannel({ url: '/log', end: isDone, scheduler: fakeScheduler() })
  const lines: string[] = []
  const ac = new AbortController()
  const reading = (async () => {
    for await (const f of channel.frames(ac.signal)) if (f.data !== '') lines.push(String(f.data))
  })()
  await flush(20)
  ac.abort()
  await reading
  return { lines, status: channel.store.getSnapshot().status }
}

/** The same chunks as frames on a fake. */
async function overFake(frames: string[], opts: { done: boolean }) {
  const fake = fakeChannel<Envelope>()
  const reading = readLines(fake)
  await flush(2)
  for (const data of frames) fake.emit({ event: 'message', data })
  if (opts.done) fake.end()
  else fake.setStatus('retrying')
  if (!opts.done) {
    // no end: stop the loop the way a caller does
    return { lines: await Promise.race([reading, flush(2).then(() => null)]), fake }
  }
  return { lines: await reading, fake }
}

describe.each([
  { name: 'createChannel', run: overWire },
  {
    name: 'fakeChannel',
    run: async (chunks: string[]) => {
      // fakeChannel starts after parsing: feed it the frames the parser would have produced
      const parsed = chunks
        .join('')
        .split('\n\n')
        .map((p) =>
          p
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).replace(/^ /, ''))
            .join('\n'),
        )
        .filter(Boolean)
      const upTo = parsed.indexOf('[DONE]')
      const lines = upTo < 0 ? parsed : parsed.slice(0, upTo)
      const r = await overFake(lines, { done: true })
      return { lines: r.lines ?? [], status: r.fake.store.getSnapshot().status }
    },
  },
])('ported sse cases on $name', ({ run }) => {
  test('parses data lines', async () => {
    const r = await run(['data: one\n\ndata: two\n\n', 'data: [DONE]\n\n'])
    expect(r.lines).toEqual(['one', 'two'])
    expect(r.status).toBe('done')
  })

  test('stops at [DONE] without emitting it', async () => {
    const r = await run(['data: one\n\ndata: [DONE]\n\ndata: after\n\n'])
    expect(r.lines).toEqual(['one'])
    expect(r.status).toBe('done')
  })

  test('ignores blank and comment events', async () => {
    const r = await run([': keepalive\n\n\n\ndata:\n\ndata: x\n\n', 'data: [DONE]\n\n'])
    expect(r.lines).toEqual(['x'])
  })

  test('keeps a partial event across chunk boundaries', async () => {
    const r = await run(['data: hel', 'lo\n', '\ndata: next\n', '\n', 'data: [DONE]\n\n'])
    expect(r.lines).toEqual(['hello', 'next'])
  })

  test('handles [DONE] split across chunks', async () => {
    const r = await run(['data: [DO', 'NE]\n\n'])
    expect(r.lines).toEqual([])
    expect(r.status).toBe('done')
  })
})
