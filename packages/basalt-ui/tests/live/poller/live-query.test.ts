/**
 * liveQuery on the P1 branch the spike chose (docs/v3/spikes/live-poller.md: poller DROP, function-
 * form `refetchInterval`): P1 six observers, P1b hidden tab, P5 retry storm, the L9 and L10
 * invariants of live-realtime.md section 5, the class mapping and the dev asserts. Fake scheduler
 * throughout: 60 s of polling is a loop.
 */
import * as core from '@tanstack/react-query'
import { queryOptions } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { makeQueryClient } from '../../../src/data/query-client'
import { liveQuery } from '../../../src/data/live/live-query'
import { setStreamLive } from '../../../src/data/live/live-query-runtime'
import { countingFetch, installClock, perInterval } from './support/harness'
import type { Clock } from './support/harness'

const EVERY = 5_000
const KEY = ['gym', 'state'] as const

let clock: Clock
beforeEach(() => {
  clock = installClock(core)
})
afterEach(() => clock.uninstall())

const ticker = (queryFn: () => Promise<unknown>, extra: Record<string, unknown> = {}) =>
  liveQuery(queryOptions({ queryKey: KEY, queryFn }), { class: 'ticker', every: EVERY, ...extra })

const mount = (client: core.QueryClient, options: unknown) =>
  new core.QueryObserver(client, options as never).subscribe(() => {})

describe('P1: six observers on one key (poller branch: none, one fetch per interval)', () => {
  test('staggered mounts over 60 s give exactly one fetch per interval', async () => {
    const client = makeQueryClient()
    client.mount()
    const { queryFn, starts } = countingFetch(clock)
    const mounts = [0, 1_100, 2_300, 3_100, 4_200, 4_700]
    let at = 0
    for (const m of mounts) {
      await clock.advance(m - at)
      at = m
      mount(client, ticker(queryFn))
    }
    await clock.advance(60_000 - at)
    // warmup: the last observer mounted at 4.7 s; measure the ten intervals from 10 s to 60 s
    expect(perInterval(starts, 10_000, 60_000, EVERY)).toEqual(Array(10).fill(1) as number[])
    expect(starts.length).toBe(12) // one mount fetch + 11 ticks: `every` after the previous result
  })
})

describe('P1b: a hidden tab', () => {
  test('showing the tab after the clock advanced gives one fetch when stale', async () => {
    const client = makeQueryClient()
    client.mount()
    const { queryFn, starts } = countingFetch(clock)
    mount(client, ticker(queryFn))
    await clock.advance(1_000)
    expect(starts.length).toBe(1)
    core.focusManager.setFocused(false)
    await clock.advance(60_000)
    expect(starts.length).toBe(1) // hidden: the timer fires and fetches nothing
    core.focusManager.setFocused(true)
    await clock.advance(1_000)
    expect(starts.length).toBe(2) // stale: exactly one pull, not one per missed tick
  })

  test('showing the tab while the data is fresh gives none', async () => {
    const client = makeQueryClient()
    client.mount()
    const { queryFn, starts } = countingFetch(clock)
    mount(client, ticker(queryFn))
    await clock.advance(1_000)
    core.focusManager.setFocused(false)
    await clock.advance(1_000)
    core.focusManager.setFocused(true)
    await clock.advance(500)
    expect(starts.length).toBe(1)
  })

  test('background: true keeps polling a hidden tab', async () => {
    const client = makeQueryClient()
    client.mount()
    const { queryFn, starts } = countingFetch(clock)
    mount(client, ticker(queryFn, { background: true }))
    core.focusManager.setFocused(false)
    await clock.advance(30_000)
    expect(starts.length).toBeGreaterThan(4)
  })
})

describe('P5: a 401 on a ticker is not a retry storm', () => {
  for (const status of [401, 403]) {
    test(`${status} gives at most one request per class interval`, async () => {
      const client = makeQueryClient()
      client.mount()
      const { queryFn, starts } = countingFetch(clock, { fail: () => ({ status }) })
      mount(client, ticker(queryFn))
      await clock.advance(60_000)
      expect(Math.max(...perInterval(starts, 0, 60_000, EVERY))).toBeLessThanOrEqual(1)
      expect(starts.length).toBe(1) // and the timer stays off until something else refetches
    })
  }

  test('a 500 retries twice, then ticks at the class interval', async () => {
    const client = makeQueryClient()
    client.mount()
    const { queryFn, starts } = countingFetch(clock, { fail: () => ({ status: 500 }) })
    mount(client, ticker(queryFn))
    await clock.advance(60_000)
    expect(starts.length).toBeGreaterThan(3) // the timer keeps running on a server error
    expect(starts.length).toBeLessThanOrEqual(3 * 12) // never faster than 3 attempts per interval
  })
})

describe('L9: staleTime equals the cadence, one decision', () => {
  test('a ticker sets staleTime from every, per query', () => {
    const client = makeQueryClient()
    const options = ticker(async () => 1) as unknown as { staleTime: (q: core.Query) => number }
    const query = client.getQueryCache().build(client, options as never)
    expect(options.staleTime(query)).toBe(EVERY)
    const fn = liveQuery(queryOptions({ queryKey: ['f'], queryFn: async () => 1 }), {
      class: 'ticker',
      every: () => 7_000,
    }) as unknown as { staleTime: (q: core.Query) => number }
    expect(fn.staleTime(query)).toBe(7_000)
  })

  test('every returning false gives staleTime 30000, not 0', () => {
    const client = makeQueryClient()
    const options = liveQuery(queryOptions({ queryKey: ['idle'], queryFn: async () => 1 }), {
      class: 'ticker',
      every: () => false,
    }) as unknown as {
      staleTime: (q: core.Query) => number
      refetchInterval: (q: core.Query) => unknown
    }
    const query = client.getQueryCache().build(client, options as never)
    expect(options.staleTime(query)).toBe(30_000)
    expect(options.refetchInterval(query)).toBe(false)
  })
})

describe('L10: background pause is the default, visible pulls once when stale', () => {
  test('a ticker does not poll in the background unless asked', () => {
    const o = ticker(async () => 1) as unknown as { refetchIntervalInBackground: boolean }
    expect(o.refetchIntervalInBackground).toBe(false)
    const b = ticker(async () => 1, { background: true }) as {
      refetchIntervalInBackground: boolean
    }
    expect(b.refetchIntervalInBackground).toBe(true)
    expect(
      (ticker(async () => 1) as unknown as { refetchOnWindowFocus: boolean }).refetchOnWindowFocus,
    ).toBe(true)
  })
})

describe('class mapping', () => {
  const base = () => queryOptions({ queryKey: ['k'], queryFn: async () => 1 })
  const view = (f: Parameters<typeof liveQuery>[1]) =>
    liveQuery(base(), f) as unknown as {
      staleTime: unknown
      refetchInterval: unknown
      refetchOnWindowFocus: boolean
      meta: { basalt: { live: { class: string; external?: true } } }
    }

  test("'static' is Infinity, never the string 'static'", () => {
    const o = view('static')
    expect(o.staleTime).toBe(Infinity)
    expect(o.refetchInterval).toBe(false)
    expect(o.meta.basalt.live.class).toBe('static')
  })

  test("'standard' refetches on focus when stale, at 30 s, with no timer", () => {
    for (const f of ['standard', { class: 'standard', onFocus: true }] as const) {
      const o = view(f)
      expect(o.staleTime).toBe(30_000)
      expect(o.refetchOnWindowFocus).toBe(true)
      expect(o.refetchInterval).toBe(false)
    }
  })

  test('external marks the query so Offline ignores it, and meta is merged', () => {
    const o = liveQuery(
      queryOptions({ queryKey: ['k'], queryFn: async () => 1, meta: { basalt: { x: 1 }, y: 2 } }),
      { class: 'ticker', every: 1_000, external: true },
    ) as unknown as { meta: { y: number; basalt: { x: number; live: { external: boolean } } } }
    expect(o.meta.y).toBe(2)
    expect(o.meta.basalt.x).toBe(1)
    expect(o.meta.basalt.live.external).toBe(true)
  })

  test('pushed polls at fallback until the stream is live, then at safety', async () => {
    const client = makeQueryClient()
    client.mount()
    const { queryFn, starts } = countingFetch(clock)
    const options = liveQuery(queryOptions({ queryKey: ['p'], queryFn }), {
      class: 'pushed',
      fallback: 2_000,
      safety: 10_000,
    })
    mount(client, options)
    await clock.advance(10_000)
    const before = starts.length
    expect(before).toBeGreaterThanOrEqual(4) // fallback cadence
    setStreamLive(client, true)
    await clock.advance(20_000)
    const during = starts.length - before
    expect(during).toBeGreaterThanOrEqual(1)
    expect(during).toBeLessThanOrEqual(3) // safety cadence
  })
})

describe('tick rules', () => {
  test('pauseWhileMutating: no tick while a mutation with the key is in flight', async () => {
    const client = makeQueryClient()
    client.mount()
    const { queryFn, starts } = countingFetch(clock)
    mount(client, ticker(queryFn, { pauseWhileMutating: ['gym', 'put'] }))
    await clock.advance(1_000)
    const before = starts.length
    const mutation = new core.MutationObserver(client, {
      mutationKey: ['gym', 'put'],
      mutationFn: async () => {
        await clock.sleep(30_000)
        return 1
      },
    })
    void mutation.mutate().catch(() => {})
    await clock.advance(20_000)
    expect(starts.length).toBe(before) // paused for the whole PUT
    await clock.advance(20_000)
    expect(starts.length).toBeGreaterThan(before) // resumed after it settled
  })

  test('offline: no request starts', async () => {
    const client = makeQueryClient()
    client.mount()
    const { queryFn, starts } = countingFetch(clock)
    mount(client, ticker(queryFn))
    await clock.advance(1_000)
    core.onlineManager.setOnline(false)
    await clock.advance(30_000)
    expect(starts.length).toBe(1)
  })

  test('a fetch in flight is joined, not doubled (cancelRefetch false)', async () => {
    const client = makeQueryClient()
    client.mount()
    const { queryFn, starts } = countingFetch(clock, { latencyMs: 12_000 })
    mount(client, ticker(queryFn))
    await clock.advance(11_000)
    expect(starts.length).toBe(1) // two ticks fired during the request; neither started another
  })

  test('the least active class wins when observers of one key disagree, and dev warns', async () => {
    const client = makeQueryClient()
    client.mount()
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    const { queryFn, starts } = countingFetch(clock)
    mount(client, ticker(queryFn))
    mount(client, liveQuery(queryOptions({ queryKey: KEY, queryFn }), 'standard'))
    await clock.advance(60_000)
    expect(starts.length).toBe(1) // the standard observer outranks the ticker: no timer
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  test('a disabled observer does not count', async () => {
    const client = makeQueryClient()
    client.mount()
    const { queryFn, starts } = countingFetch(clock)
    mount(client, ticker(queryFn))
    mount(client, {
      ...liveQuery(queryOptions({ queryKey: KEY, queryFn }), 'static'),
      enabled: false,
    })
    await clock.advance(30_000)
    expect(starts.length).toBeGreaterThan(4)
  })
})

describe('dev asserts', () => {
  test('a bare new QueryClient() with a liveQuery throws in dev', async () => {
    const client = new core.QueryClient()
    const { queryFn } = countingFetch(clock)
    const options = ticker(queryFn)
    await expect(client.fetchQuery(options as never)).rejects.toThrow(/makeQueryClient/)
  })

  test('options that already set staleTime or refetchInterval throw', () => {
    const base = queryOptions({ queryKey: ['k'], queryFn: async () => 1, staleTime: 5 })
    expect(() => liveQuery(base, 'standard')).toThrow(/staleTime or refetchInterval/)
  })

  test('an observer overriding the class staleTime warns', async () => {
    const client = makeQueryClient()
    client.mount()
    const warn = spyOn(console, 'warn').mockImplementation(() => {})
    const { queryFn } = countingFetch(clock)
    mount(client, {
      ...liveQuery(queryOptions({ queryKey: ['o'], queryFn }), 'standard'),
      staleTime: 5,
    })
    await clock.advance(1_000)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })

  test('a skipToken queryFn is left alone', () => {
    const o = liveQuery({ queryKey: ['s'], queryFn: core.skipToken }, 'standard')
    expect(o.queryFn).toBe(core.skipToken)
  })
})
