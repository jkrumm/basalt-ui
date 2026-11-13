/**
 * The offline classifier (live-realtime 4.3): only a fetch `TypeError` or `NetworkError` from a
 * `liveQuery` that is not `external` counts, three in a row, held 5 s; any response resets; the
 * store never flips Query's `onlineManager`. The clock is injected.
 */
import { onlineManager } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import type { ChannelState, Scheduler } from '../../core/channel'
import { makeQueryClient } from '../query-client'
import { NetworkError } from '../unwrap'
import { HYSTERESIS_MS, createConnectionStore } from './connection'
import type { ConnectionStore } from './connection'
import type { Freshness } from './live-query'
import { liveQuery } from './live-query'

class ZodErrorLike extends Error {
  override name = 'ZodError'
}

function fakeClock(): Scheduler & { advance(ms: number): void } {
  let now = 1_000_000
  let pending: { at: number; fn: () => void; handle: number } | undefined
  let next = 1
  return {
    now: () => now,
    set(fn, ms) {
      pending = { at: now + ms, fn, handle: next }
      return next++
    },
    clear(handle) {
      if (pending?.handle === handle) pending = undefined
    },
    advance(ms) {
      now += ms
      if (pending && pending.at <= now) {
        const { fn } = pending
        pending = undefined
        fn()
      }
    },
  }
}

let client: QueryClient
let clock: ReturnType<typeof fakeClock>
let store: ConnectionStore
let off: () => void
let seq = 0

beforeEach(() => {
  client = makeQueryClient({ defaultOptions: { queries: { retry: false } } })
  clock = fakeClock()
  store = createConnectionStore(client, clock)
  off = store.subscribe(() => {})
})
afterEach(() => {
  off()
  onlineManager.setOnline(true)
})

/** One fetch of a fresh `liveQuery` that settles with `outcome` (a thrown value, or `'ok'`). */
async function poll(outcome: unknown, freshness: Freshness = 'standard'): Promise<void> {
  const options = liveQuery(
    {
      queryKey: ['classifier', seq++],
      queryFn: async () => {
        if (outcome === 'ok') return 1
        throw outcome
      },
    },
    freshness,
  )
  await client.fetchQuery(options).catch(() => {})
}

const repeat = async (n: number, outcome: () => unknown, freshness?: Freshness) => {
  for (let i = 0; i < n; i += 1) await poll(outcome(), freshness)
}
const fetchFailure = () => new TypeError('Failed to fetch')

describe('classifier', () => {
  test('three ZodErrors keep live', async () => {
    await repeat(3, () => new ZodErrorLike('shape'))
    expect(store.getSnapshot().reachable).toBe(true)
    expect(store.getSnapshot().state).toBe('polling')
  })

  test('three failed external polls keep live', async () => {
    await repeat(3, fetchFailure, { class: 'ticker', every: 1_000, external: true })
    expect(store.getSnapshot().reachable).toBe(true)
  })

  test('three TypeErrors go offline', async () => {
    await repeat(2, fetchFailure)
    expect(store.getSnapshot().state).toBe('polling')
    await poll(fetchFailure())
    expect(store.getSnapshot()).toMatchObject({ state: 'offline', reachable: false, online: true })
  })

  test('a NetworkError counts as a TypeError does', async () => {
    await repeat(3, () => new NetworkError(fetchFailure()))
    expect(store.getSnapshot().state).toBe('offline')
  })

  test('a 503 resets the count', async () => {
    await repeat(2, fetchFailure)
    await poll(Object.assign(new Error('unavailable'), { status: 503 }))
    await repeat(2, fetchFailure)
    expect(store.getSnapshot().reachable).toBe(true)
    await poll(fetchFailure())
    expect(store.getSnapshot().state).toBe('offline')
  })

  test('a 4xx resets the count too, and a ZodError neither counts nor resets', async () => {
    await repeat(2, fetchFailure)
    await poll(new ZodErrorLike('shape'))
    await poll(fetchFailure())
    expect(store.getSnapshot().state).toBe('offline')
    await poll(Object.assign(new Error('gone'), { status: 404 }))
    clock.advance(HYSTERESIS_MS)
    expect(store.getSnapshot().reachable).toBe(true)
  })

  test('a query that is not a liveQuery is not counted', async () => {
    for (let i = 0; i < 3; i += 1) {
      await client
        .fetchQuery({
          queryKey: ['plain', i],
          queryFn: () => Promise.reject(fetchFailure()),
        })
        .catch(() => {})
    }
    expect(store.getSnapshot().reachable).toBe(true)
  })

  test('never flips onlineManager', async () => {
    await repeat(3, fetchFailure)
    expect(store.getSnapshot().state).toBe('offline')
    expect(onlineManager.isOnline()).toBe(true)
  })
})

describe('hysteresis', () => {
  test('recovery is held until 5 s after going offline, then applied', async () => {
    await repeat(3, fetchFailure)
    expect(store.getSnapshot().state).toBe('offline')
    clock.advance(1_000)
    await poll('ok')
    expect(store.getSnapshot().reachable).toBe(false)
    clock.advance(HYSTERESIS_MS - 1_000)
    expect(store.getSnapshot()).toMatchObject({ reachable: true, state: 'polling' })
  })

  test('a failure during the hold cancels the recovery', async () => {
    await repeat(3, fetchFailure)
    clock.advance(1_000)
    await poll('ok')
    await repeat(3, fetchFailure)
    clock.advance(HYSTERESIS_MS)
    expect(store.getSnapshot().reachable).toBe(false)
  })

  test('a recovery after the hold is immediate', async () => {
    await repeat(3, fetchFailure)
    clock.advance(HYSTERESIS_MS + 1)
    await poll('ok')
    expect(store.getSnapshot().reachable).toBe(true)
  })
})

describe('online and data age', () => {
  test('the browser reporting offline is offline, and recovers with it', () => {
    onlineManager.setOnline(false)
    expect(store.getSnapshot()).toMatchObject({ state: 'offline', online: false, reachable: true })
    onlineManager.setOnline(true)
    expect(store.getSnapshot().state).toBe('polling')
  })

  test('lastUpdatedAt follows the newest data in the cache', async () => {
    expect(store.getSnapshot().lastUpdatedAt).toBeUndefined()
    await poll('ok')
    expect(store.getSnapshot().lastUpdatedAt).toBeGreaterThan(0)
  })

  test('the snapshot is stable until something changes', async () => {
    const before = store.getSnapshot()
    await poll(new ZodErrorLike('shape'))
    expect(store.getSnapshot()).toBe(before)
  })

  test('the server snapshot is one constant', () => {
    expect(store.getServerSnapshot()).toBe(store.getServerSnapshot())
    expect(store.getServerSnapshot()).toEqual({
      state: 'polling',
      stream: 'none',
      online: true,
      reachable: true,
    })
  })
})

describe('channel', () => {
  const state = (patch: Partial<ChannelState> & Pick<ChannelState, 'status'>): ChannelState => ({
    attempt: 0,
    ...patch,
  })

  test('a live stream is live, with its last frame', () => {
    store.feedChannel(state({ status: 'live', lastFrameAt: 42 }))
    expect(store.getSnapshot()).toMatchObject({ state: 'live', stream: 'live', lastFrameAt: 42 })
  })

  test('a retrying stream polls and names its stream state', () => {
    store.feedChannel(state({ status: 'retrying', attempt: 1, error: { status: 502 } }))
    expect(store.getSnapshot()).toMatchObject({ state: 'polling', stream: 'retrying' })
  })

  test('three network connect failures go offline; the same attempt twice counts once', () => {
    store.feedChannel(state({ status: 'retrying', attempt: 1, error: fetchFailure() }))
    store.feedChannel(state({ status: 'retrying', attempt: 1, error: fetchFailure() }))
    store.feedChannel(state({ status: 'retrying', attempt: 2, error: fetchFailure() }))
    expect(store.getSnapshot().reachable).toBe(true)
    store.feedChannel(state({ status: 'retrying', attempt: 3, error: fetchFailure() }))
    expect(store.getSnapshot().state).toBe('offline')
  })

  test('an HTTP failure on connect is a response: it resets the count', () => {
    store.feedChannel(state({ status: 'retrying', attempt: 1, error: fetchFailure() }))
    store.feedChannel(state({ status: 'retrying', attempt: 2, error: fetchFailure() }))
    store.feedChannel(state({ status: 'retrying', attempt: 3, error: { status: 503 } }))
    store.feedChannel(state({ status: 'retrying', attempt: 4, error: fetchFailure() }))
    expect(store.getSnapshot().reachable).toBe(true)
  })
})
