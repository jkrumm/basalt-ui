/**
 * P3 (live-realtime.md section 7), one matrix run against two Query cores: the devDependency
 * 5.107.1 and argo's 5.101.2 (the nested `query-5101` package). Pins section 4.6 (`'static'` makes a
 * query immune to a push, `Infinity` does not), the `every` returning `false` staleness, and
 * `refetchInterval` per-observer behaviour for the least-active rule.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { installLiveRuntime } from '../../../../src/data/live/live-query-runtime'
import { liveQuery } from '../../../../src/data/live/live-query'
import { countingFetch, installClock } from './harness'
import type { Clock, Core } from './harness'

export function p3Matrix(core: Core, version: string): void {
  describe(`P3 on Query ${version}`, () => {
    let clock: Clock
    beforeEach(() => {
      clock = installClock(core)
    })
    afterEach(() => clock.uninstall())

    const liveClient = () => {
      const client = new core.QueryClient({ defaultOptions: { queries: { retry: false } } })
      installLiveRuntime(client as never)
      client.mount()
      return client
    }
    const mount = (client: InstanceType<Core['QueryClient']>, options: unknown) =>
      new core.QueryObserver(client, options as never).subscribe(() => {})
    const KEY = ['p3'] as const

    test("invalidate against staleTime 'static' ignores a push", async () => {
      const client = liveClient()
      const { queryFn, starts } = countingFetch(clock, { latencyMs: 10 })
      mount(client, { queryKey: KEY, queryFn, staleTime: 'static' })
      await clock.advance(1_000)
      expect(starts.length).toBe(1)
      await client.invalidateQueries({ queryKey: KEY })
      await clock.advance(1_000)
      expect(starts.length).toBe(1) // the string 'static' swallowed the invalidation
    })

    test("liveQuery 'static' maps to Infinity and is not ignored", async () => {
      const client = liveClient()
      const { queryFn, starts } = countingFetch(clock, { latencyMs: 10 })
      const options = liveQuery({ queryKey: KEY, queryFn }, 'static')
      expect((options as { staleTime?: unknown }).staleTime).toBe(Infinity)
      mount(client, options)
      await clock.advance(1_000)
      expect(starts.length).toBe(1)
      void client.invalidateQueries({ queryKey: KEY })
      await clock.advance(1_000)
      expect(starts.length).toBe(2)
    })

    test('every returning false gives staleTime 30000', async () => {
      const client = liveClient()
      const { queryFn, starts } = countingFetch(clock, { latencyMs: 10 })
      const options = liveQuery({ queryKey: KEY, queryFn }, { class: 'ticker', every: () => false })
      const first = mount(client, options)
      await clock.advance(1_000)
      expect(starts.length).toBe(1)
      first()
      await clock.advance(20_000) // 21 s old: fresh at 30 s
      mount(client, options)
      await clock.advance(1_000)
      expect(starts.length).toBe(1)
      await clock.advance(20_000) // 42 s old: stale
      mount(client, options)
      await clock.advance(1_000)
      expect(starts.length).toBe(2)
    })

    test('a ticker polls at every, and a standard observer on the key stops it', async () => {
      const client = liveClient()
      const warn = spyOn(console, 'warn').mockImplementation(() => {})
      const { queryFn, starts } = countingFetch(clock, { latencyMs: 10 })
      const ticker = liveQuery({ queryKey: KEY, queryFn }, { class: 'ticker', every: 5_000 })
      const off = mount(client, ticker)
      await clock.advance(30_000)
      expect(starts.length).toBeGreaterThanOrEqual(5)
      const polled = starts.length
      mount(client, liveQuery({ queryKey: KEY, queryFn }, 'standard'))
      await clock.advance(1_000) // the next result re-arms the timers; the ticker defers
      const settled = starts.length
      await clock.advance(30_000)
      expect(starts.length).toBe(settled)
      expect(settled).toBeLessThanOrEqual(polled + 1)
      off()
      warn.mockRestore()
    })
  })
}
