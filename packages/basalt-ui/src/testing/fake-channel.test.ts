/** `fakeChannel` drives the same `Channel` surface `createChannel` has. */
import { describe, expect, test } from 'bun:test'
import { ChannelReset } from '../core/channel'
import type { Delivered } from '../core/channel'
import { fakeChannel } from './fake-channel'

describe('fakeChannel', () => {
  test('emit reaches subscribers with the event and id; setStatus, drop and end move the store', () => {
    const ch = fakeChannel<{ n: number }>()
    const got: Delivered<{ n: number }>[] = []
    const off = ch.subscribe((d) => got.push(d))
    ch.emit({ n: 1 }, { id: 'a', event: 'tick' })
    expect(got).toEqual([{ kind: 'frame', ok: true, value: { n: 1 }, id: 'a', event: 'tick' }])
    expect(ch.store.getSnapshot().status).toBe('live')
    ch.drop()
    expect(ch.store.getSnapshot()).toMatchObject({ status: 'retrying', attempt: 1 })
    ch.setStatus('unauthorized')
    expect(ch.store.getSnapshot().status).toBe('unauthorized')
    ch.end()
    expect(ch.store.getSnapshot().status).toBe('done')
    off()
    ch.emit({ n: 2 })
    expect(got).toHaveLength(1)
  })

  test('store notifies; the server snapshot is constant', () => {
    const ch = fakeChannel<number>()
    let calls = 0
    const off = ch.store.subscribe(() => calls++)
    ch.setStatus('connecting')
    ch.setStatus('live')
    expect(calls).toBe(2)
    expect(ch.store.getServerSnapshot()).toBe(ch.store.getServerSnapshot())
    off()
  })

  test('frames() yields what is emitted and completes on end', async () => {
    const ch = fakeChannel<number>()
    const seen: number[] = []
    const reading = (async () => {
      for await (const n of ch.frames()) seen.push(n)
    })()
    await Promise.resolve()
    ch.emit(1)
    ch.emit(2)
    ch.end()
    await reading
    expect(seen).toEqual([1, 2])
  })

  test('frames() throws ChannelReset on a reset, and stops on abort', async () => {
    const ch = fakeChannel<number>()
    const reading = (async () => {
      for await (const n of ch.frames()) void n
    })()
    await Promise.resolve()
    ch.reset('expired')
    await expect(reading).rejects.toBeInstanceOf(ChannelReset)

    const ac = new AbortController()
    const aborted = (async () => {
      for await (const n of ch.frames(ac.signal)) void n
    })()
    await Promise.resolve()
    ac.abort()
    await aborted
  })
})
