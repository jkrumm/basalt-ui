/**
 * `createChannel` behaviour on a hand-driven transport and a fake scheduler: retry law (L13),
 * the watchdog and the visibility compare (L5), refcounting, resume, dedupe, end, `frames()`.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { ChannelReset, createChannel } from '../../../src/core/channel'
import type { Delivered, Envelope } from '../../../src/core/channel'
import { controlled, fakeScheduler, flush } from './support'

const HB = 7_000
const SILENCE = 3 * HB

let randomSpy: ReturnType<typeof spyOn>
beforeEach(() => {
  randomSpy = spyOn(Math, 'random').mockReturnValue(1)
})
afterEach(() => randomSpy.mockRestore())

const collect = (channel: { subscribe: (on: (d: Delivered<Envelope>) => void) => () => void }) => {
  const got: Delivered<Envelope>[] = []
  const off = channel.subscribe((d) => got.push(d))
  return { got, off }
}

describe('retry law', () => {
  test('401 and 403 are terminal: no second connection, ever', async () => {
    for (const status of [401, 403]) {
      const sched = fakeScheduler()
      const { transport, conns } = controlled((c) => c.fail({ status }))
      const channel = createChannel({ transport, scheduler: sched, heartbeatMs: HB })
      const { off } = collect(channel)
      await flush()
      await sched.advance(10 * 60_000)
      expect(conns).toHaveLength(1)
      expect(channel.store.getSnapshot().status).toBe('unauthorized')
      off()
    }
  })

  test('backoff doubles with jitter at most the step, caps at 30000 ms', async () => {
    const sched = fakeScheduler()
    const { transport, conns } = controlled((c) => c.fail({ status: 503 }))
    const channel = createChannel({ transport, scheduler: sched, heartbeatMs: HB })
    const { off } = collect(channel)
    await flush()
    for (let i = 0; i < 8; i++) await sched.advance(30_000)
    const sleeps = sched.delays.filter((d) => d !== SILENCE)
    expect(sleeps.slice(0, 8)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000])
    expect(Math.max(...sleeps)).toBe(30_000)
    expect(conns.length).toBeGreaterThan(8)
    off()
  })

  test('jitter stays inside half the step and the step', async () => {
    randomSpy.mockReturnValue(0)
    const sched = fakeScheduler()
    const { transport } = controlled((c) => c.fail({ status: 503 }))
    const channel = createChannel({ transport, scheduler: sched, heartbeatMs: HB })
    const { off } = collect(channel)
    await flush()
    await sched.advance(30_000)
    expect(sched.delays.filter((d) => d !== SILENCE)[0]).toBe(500)
    off()
  })

  test('backoff resets on the first byte', async () => {
    const sched = fakeScheduler()
    let n = 0
    const { transport, conns } = controlled((c) => {
      n++
      if (n <= 3) c.fail({ status: 503 })
      else if (n === 4) {
        c.push({ kind: 'beat' })
        c.close()
      } else c.fail({ status: 503 })
    })
    const channel = createChannel({ transport, scheduler: sched, heartbeatMs: HB })
    const { off } = collect(channel)
    await flush()
    for (let i = 0; i < 6; i++) await sched.advance(30_000)
    const sleeps = sched.delays.filter((d) => d !== SILENCE)
    // 1s, 2s, 4s while failing; the fourth connect gets a byte, so its drop counts as the first failure again
    expect(sleeps.slice(0, 5)).toEqual([1000, 2000, 4000, 1000, 2000])
    expect(conns.length).toBeGreaterThan(5)
    off()
  })

  test('a client error other than 408/425/429 is failed, not retried', async () => {
    const sched = fakeScheduler()
    const { transport, conns } = controlled((c) => c.fail({ status: 404 }))
    const channel = createChannel({ transport, scheduler: sched })
    const { off } = collect(channel)
    await flush()
    await sched.advance(120_000)
    expect(conns).toHaveLength(1)
    expect(channel.store.getSnapshot().status).toBe('failed')
    off()
  })

  test('a 429 retries', async () => {
    const sched = fakeScheduler()
    const { transport, conns } = controlled((c) => c.fail({ status: 429 }))
    const channel = createChannel({ transport, scheduler: sched })
    const { off } = collect(channel)
    await flush()
    await sched.advance(5_000)
    expect(conns.length).toBeGreaterThan(1)
    off()
  })
})

describe('watchdog', () => {
  test('3x byte silence replaces the connection; a beat resets the count', async () => {
    const sched = fakeScheduler()
    const { transport, conns } = controlled((c) => c.push({ kind: 'beat' }))
    const channel = createChannel({ transport, scheduler: sched, heartbeatMs: HB })
    const { off } = collect(channel)
    await flush()
    expect(channel.store.getSnapshot().status).toBe('live')
    await sched.advance(SILENCE - 1_000)
    conns[0]!.push({ kind: 'beat' })
    await flush()
    await sched.advance(SILENCE - 1_000)
    expect(conns).toHaveLength(1)
    await sched.advance(2_000)
    expect(conns[0]!.signal.aborted).toBe(true)
    await sched.advance(2_000)
    expect(conns).toHaveLength(2)
    off()
  })

  describe('visibilitychange compares now() with lastByteAt (L5)', () => {
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
    const original = Object.getOwnPropertyDescriptor(globalThis, 'document')
    beforeEach(() => {
      doc.visibilityState = 'visible'
      Object.defineProperty(globalThis, 'document', {
        value: doc,
        configurable: true,
        writable: true,
      })
    })
    afterEach(() => {
      if (original) Object.defineProperty(globalThis, 'document', original)
      else Reflect.deleteProperty(globalThis, 'document')
    })
    const show = () => {
      doc.visibilityState = 'visible'
      doc.dispatchEvent(new Event('visibilitychange'))
    }

    test('silent past 3x while timers were frozen: replaced at once, no timer fired', async () => {
      const sched = fakeScheduler()
      const { transport, conns } = controlled((c) => c.push({ kind: 'beat' }))
      const channel = createChannel({ transport, scheduler: sched, heartbeatMs: HB })
      const { off } = collect(channel)
      await flush()
      sched.freeze(SILENCE + 1)
      show()
      await flush()
      expect(conns).toHaveLength(2)
      off()
    })

    test('recent byte: the connection is kept', async () => {
      const sched = fakeScheduler()
      const { transport, conns } = controlled((c) => c.push({ kind: 'beat' }))
      const channel = createChannel({ transport, scheduler: sched, heartbeatMs: HB })
      const { off } = collect(channel)
      await flush()
      sched.freeze(SILENCE - 1)
      show()
      await flush()
      expect(conns).toHaveLength(1)
      off()
    })

    test('hidden does nothing; showing wakes a channel that sleeps in backoff', async () => {
      const sched = fakeScheduler()
      const { transport, conns } = controlled((c) => c.fail({ status: 503 }))
      const channel = createChannel({ transport, scheduler: sched, heartbeatMs: HB })
      const { off } = collect(channel)
      await flush()
      expect(conns).toHaveLength(1)
      doc.visibilityState = 'hidden'
      doc.dispatchEvent(new Event('visibilitychange'))
      await flush()
      expect(conns).toHaveLength(1)
      show()
      await flush()
      expect(conns.length).toBeGreaterThan(1)
      off()
    })
  })
})

describe('hub', () => {
  test('refcounted: one connection for many; the last unsubscribe closes after 1 s', async () => {
    const sched = fakeScheduler()
    const { transport, conns } = controlled((c) => c.push({ kind: 'beat' }))
    const channel = createChannel({ transport, scheduler: sched })
    const a = collect(channel)
    const b = collect(channel)
    await flush()
    expect(conns).toHaveLength(1)
    a.off()
    await sched.advance(5_000)
    expect(conns[0]!.signal.aborted).toBe(false)
    b.off()
    await sched.advance(999)
    expect(conns[0]!.signal.aborted).toBe(false)
    await sched.advance(2)
    expect(conns[0]!.signal.aborted).toBe(true)
    expect(channel.store.getSnapshot().status).toBe('idle')
  })

  test('a resubscribe inside the second keeps the connection (StrictMode)', async () => {
    const sched = fakeScheduler()
    const { transport, conns } = controlled((c) => c.push({ kind: 'beat' }))
    const channel = createChannel({ transport, scheduler: sched })
    collect(channel).off()
    const again = collect(channel)
    await sched.advance(5_000)
    expect(conns).toHaveLength(1)
    expect(conns[0]!.signal.aborted).toBe(false)
    again.off()
  })

  test('a throwing subscriber does not stop the others or the stream', async () => {
    const sched = fakeScheduler()
    const { transport, conns } = controlled()
    const channel = createChannel({ transport, scheduler: sched })
    const logged = spyOn(console, 'error').mockImplementation(() => {})
    const off1 = channel.subscribe(() => {
      throw new Error('boom')
    })
    const { got, off } = collect(channel)
    await flush()
    conns[0]!.frame('a', '1')
    conns[0]!.frame('b', '2')
    await flush()
    expect(logged).toHaveBeenCalledTimes(2)
    logged.mockRestore()
    expect(got).toHaveLength(2)
    off1()
    off()
  })

  test('a done channel is not restarted by another subscriber', async () => {
    const sched = fakeScheduler()
    const { transport, conns } = controlled((c) => c.frame('end', ''))
    const channel = createChannel({ transport, scheduler: sched, end: 'end' })
    const a = collect(channel)
    await flush()
    expect(channel.store.getSnapshot().status).toBe('done')
    const b = collect(channel)
    await flush()
    expect(conns).toHaveLength(1)
    a.off()
    b.off()
  })
})

describe('frames on the wire', () => {
  test('envelope: JSON data parsed, else the string; event defaults carried through', async () => {
    const { transport, conns } = controlled()
    const channel = createChannel({ transport, scheduler: fakeScheduler() })
    const { got, off } = collect(channel)
    await flush()
    conns[0]!.frame('job', '{"n":1}', '7')
    conns[0]!.frame('log', 'plain text')
    await flush()
    expect(got).toEqual([
      {
        kind: 'frame',
        ok: true,
        event: 'job',
        id: '7',
        value: { event: 'job', id: '7', data: { n: 1 } },
      },
      { kind: 'frame', ok: true, event: 'log', value: { event: 'log', data: 'plain text' } },
    ])
    off()
  })

  test('schema failure is delivered as ok:false with the raw text, never dropped', async () => {
    const { transport, conns } = controlled()
    const channel = createChannel<{ n: number }>({
      transport,
      scheduler: fakeScheduler(),
      schema: {
        '~standard': {
          validate: (e) => {
            const data = (e as Envelope).data as { n?: unknown }
            return typeof data.n === 'number' ? { value: { n: data.n } } : { issues: [{}] }
          },
        },
      },
    })
    const got: Delivered<{ n: number }>[] = []
    const off = channel.subscribe((d) => got.push(d))
    await flush()
    conns[0]!.frame('x', '{"n":2}')
    conns[0]!.frame('x', '{"n":"two"}')
    await flush()
    expect(got.map((d) => d.kind === 'frame' && d.ok)).toEqual([true, false])
    expect(got[1]).toMatchObject({ ok: false, raw: '{"n":"two"}' })
    off()
  })

  test('named beats reset the watchdog and are never delivered', async () => {
    const sched = fakeScheduler()
    const { transport, conns } = controlled()
    const channel = createChannel({
      transport,
      scheduler: sched,
      beats: ['heartbeat'],
      heartbeatMs: HB,
    })
    const { got, off } = collect(channel)
    await flush()
    for (let i = 0; i < 6; i++) {
      conns[0]!.frame('heartbeat', '')
      await sched.advance(SILENCE - 1_000)
    }
    expect(got).toEqual([])
    expect(conns).toHaveLength(1)
    off()
  })

  test('repeat filter: a replayed id is dropped; the window holds 256 ids', async () => {
    const { transport, conns } = controlled()
    const channel = createChannel({ transport, scheduler: fakeScheduler() })
    const { got, off } = collect(channel)
    await flush()
    conns[0]!.frame('m', '0', 'first')
    conns[0]!.frame('m', '0', 'first')
    for (let i = 0; i < 256; i++) conns[0]!.frame('m', String(i), `id-${i}`)
    conns[0]!.frame('m', '0', 'first')
    await flush(30)
    const ids = got.map((d) => (d.kind === 'frame' ? d.id : undefined))
    expect(ids.filter((i) => i === 'first')).toHaveLength(2)
    expect(ids.filter((i) => i === 'id-0')).toHaveLength(1)
    off()
  })

  test('greeting sets live; before it the channel is still connecting', async () => {
    const { transport, conns } = controlled()
    const channel = createChannel({ transport, scheduler: fakeScheduler(), greeting: 'hello' })
    const { got, off } = collect(channel)
    await flush()
    conns[0]!.push({ kind: 'beat' })
    await flush()
    expect(channel.store.getSnapshot().status).toBe('connecting')
    conns[0]!.frame('hello', '{}')
    await flush()
    expect(channel.store.getSnapshot().status).toBe('live')
    expect(got).toHaveLength(1)
    off()
  })

  test('end as a function runs on the raw frame; the end frame is not delivered', async () => {
    const sched = fakeScheduler()
    const { transport, conns } = controlled((c) => {
      c.frame('message', 'one')
      c.frame('message', '[DONE]')
    })
    const channel = createChannel({
      transport,
      scheduler: sched,
      end: (raw) => raw.data === '[DONE]',
    })
    const { got, off } = collect(channel)
    await flush()
    await sched.advance(60_000)
    expect(got).toHaveLength(1)
    expect(channel.store.getSnapshot().status).toBe('done')
    expect(conns).toHaveLength(1)
    off()
  })
})

describe('resume and reset', () => {
  test('the last id is the cursor of the next connect', async () => {
    const sched = fakeScheduler()
    const { transport, conns } = controlled((c) => {
      if (c.cursor === undefined) {
        c.frame('m', 'a', '1')
        c.frame('m', 'b', '2')
        c.close()
      }
    })
    const channel = createChannel({ transport, scheduler: sched, resume: 'header' })
    const { got, off } = collect(channel)
    await flush()
    await sched.advance(2_000)
    expect(conns.map((c) => c.cursor)).toEqual([undefined, '2'])
    expect(got.some((d) => d.kind === 'reset')).toBe(false)
    off()
  })

  test('cursorless: a reconnect after the stream was live delivers a gap before new frames', async () => {
    const sched = fakeScheduler()
    const { transport, conns } = controlled((c) => {
      c.frame('m', 'x')
      if (conns_n++ === 0) c.close()
    })
    let conns_n = 0
    const channel = createChannel({ transport, scheduler: sched })
    const { got, off } = collect(channel)
    await flush()
    await sched.advance(2_000)
    expect(conns.map((c) => c.cursor)).toEqual([undefined, undefined])
    expect(got.map((d) => (d.kind === 'reset' ? `reset:${d.reason}` : 'frame'))).toEqual([
      'frame',
      'reset:gap',
      'frame',
    ])
    off()
  })

  test('410 on a held cursor: reset expired, reconnect at once without a cursor', async () => {
    const sched = fakeScheduler()
    const { transport, conns } = controlled((c) => {
      if (c.cursor === undefined && conns_n++ === 0) {
        c.frame('m', 'x', '5')
        c.close()
      } else if (c.cursor === '5') c.fail({ status: 410 })
      else c.frame('m', 'fresh', '9')
    })
    let conns_n = 0
    const channel = createChannel({ transport, scheduler: sched, resume: { param: 'since' } })
    const { got, off } = collect(channel)
    await flush()
    await sched.advance(2_000)
    expect(conns.map((c) => c.cursor)).toEqual([undefined, '5', undefined])
    expect(got.map((d) => (d.kind === 'reset' ? `reset:${d.reason}` : 'frame'))).toEqual([
      'frame',
      'reset:expired',
      'frame',
    ])
    off()
  })

  test('a 410 with no cursor is an outage, not a reset loop', async () => {
    const sched = fakeScheduler()
    const { transport, conns } = controlled((c) => c.fail({ status: 410 }))
    const channel = createChannel({ transport, scheduler: sched })
    const { got, off } = collect(channel)
    await flush()
    expect(conns).toHaveLength(1)
    expect(got).toEqual([])
    expect(channel.store.getSnapshot().status).toBe('retrying')
    off()
  })
})

describe('frames()', () => {
  test('yields values, completes on end, and holds the stream until pulled', async () => {
    const { transport, conns } = controlled((c) => {
      c.frame('m', '1')
      c.frame('m', '2')
      c.frame('m', '3')
      c.frame('end', '')
    })
    const channel = createChannel({ transport, scheduler: fakeScheduler(), end: 'end' })
    const it = channel.frames()[Symbol.asyncIterator]()
    const first = await it.next()
    expect(first.value).toMatchObject({ event: 'm', data: 1 })
    await flush()
    // frame 1 is delivered and unconsumed work is not pulled ahead of the consumer
    expect(conns[0]!.pulls).toBe(1)
    const rest: unknown[] = []
    for (let r = await it.next(); !r.done; r = await it.next())
      rest.push((r.value as Envelope).data)
    expect(rest).toEqual([2, 3])
  })

  test('a reset throws ChannelReset', async () => {
    // a 410 only resets once a cursor is held: stream one id, drop, and the resume answers 410
    const seeded = controlled((c) => {
      if (c.cursor === undefined) {
        c.frame('m', 'x', '1')
        c.close()
      } else c.fail({ status: 410 })
    })
    const sched = fakeScheduler()
    const ch = createChannel({ transport: seeded.transport, scheduler: sched, resume: 'header' })
    const seen: unknown[] = []
    const run = (async () => {
      try {
        for await (const f of ch.frames()) seen.push(f)
      } catch (e) {
        return e
      }
    })()
    await flush()
    await sched.advance(2_000)
    const err = await run
    expect(err).toBeInstanceOf(ChannelReset)
    expect((err as ChannelReset).reason).toBe('expired')
    expect(seen).toHaveLength(1)
  })

  test('401 throws out of the loop instead of completing it', async () => {
    const { transport } = controlled((c) => c.fail({ status: 401 }))
    const channel = createChannel({ transport, scheduler: fakeScheduler() })
    let caught: unknown
    try {
      for await (const _ of channel.frames()) void _
    } catch (e) {
      caught = e
    }
    expect(caught).toEqual({ status: 401 })
  })

  test('the abort signal ends the loop and closes the connection', async () => {
    const { transport, conns } = controlled()
    const channel = createChannel({ transport, scheduler: fakeScheduler() })
    const ac = new AbortController()
    const done = (async () => {
      for await (const _ of channel.frames(ac.signal)) void _
    })()
    await flush()
    ac.abort()
    await done
    expect(conns[0]!.signal.aborted).toBe(true)
  })
})

describe('store', () => {
  test('server snapshot is one constant object; client snapshot changes only on a change', async () => {
    const { transport, conns } = controlled()
    const channel = createChannel({ transport, scheduler: fakeScheduler() })
    expect(channel.store.getServerSnapshot()).toBe(channel.store.getServerSnapshot())
    expect(channel.store.getSnapshot()).toBe(channel.store.getSnapshot())
    let calls = 0
    const unsubscribe = channel.store.subscribe(() => calls++)
    const { off } = collect(channel)
    await flush()
    conns[0]!.push({ kind: 'beat' })
    await flush()
    const snap = channel.store.getSnapshot()
    expect(snap.status).toBe('live')
    expect(channel.store.getServerSnapshot().status).toBe('idle')
    expect(calls).toBeGreaterThan(0)
    unsubscribe()
    off()
  })
})
