/** `useFreshness`: the derived view, the button props, `source`, and the stable snapshot. */
import { QueryClientProvider, useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, jest, test } from 'bun:test'
import { makeQueryClient } from '../query-client'
import { FRESHNESS_TICK_MS, useFreshness } from './freshness'
import { liveQuery } from './live-query'

let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
)

beforeEach(() => {
  client = makeQueryClient({ defaultOptions: { queries: { retry: false } } })
})
afterEach(cleanup)

type Run = { key: string; fn: () => Promise<unknown> }
const observed = (run: Run, freshness: Parameters<typeof liveQuery>[1] = 'standard') =>
  renderHook(
    () => {
      const q = useQuery(liveQuery({ queryKey: [run.key], queryFn: run.fn }, freshness))
      return { q, freshness: useFreshness([[run.key]]) }
    },
    { wrapper },
  )

const settle = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))))

describe('useFreshness', () => {
  test('none with no active query', () => {
    const { result } = renderHook(() => useFreshness([['absent']]), { wrapper })
    expect(result.current.fetch).toBe('none')
    expect(result.current.button.syncing).toBe(false)
    expect(result.current.button.lastCompletedAt).toBeUndefined()
  })

  test('fresh after a fetch, with the completion time', async () => {
    const view = observed({ key: 'a', fn: async () => 1 })
    await settle()
    expect(view.result.current.freshness.fetch).toBe('fresh')
    expect(view.result.current.freshness.button.lastCompletedAt).toBeGreaterThan(0)
    expect(view.result.current.freshness.button.syncing).toBe(false)
  })

  test('syncing while a refetch runs; onSync invalidates the keys', async () => {
    let calls = 0
    let release = () => {}
    const view = observed({
      key: 'b',
      fn: () => {
        calls += 1
        return calls === 1 ? Promise.resolve(1) : new Promise((r) => (release = () => r(2)))
      },
    })
    await settle()
    act(() => view.result.current.freshness.button.onSync())
    await settle()
    expect(calls).toBe(2)
    expect(view.result.current.freshness.button.syncing).toBe(true)
    await act(async () => release())
    await settle()
    expect(view.result.current.freshness.button.syncing).toBe(false)
  })

  test('error carries the failing query message and outranks the rest', async () => {
    const view = observed({ key: 'c', fn: () => Promise.reject(new Error('Upstream 503')) })
    await settle()
    expect(view.result.current.freshness.fetch).toBe('error')
    expect(view.result.current.freshness.button.error).toBe('Upstream 503')
  })

  test('stale once the query is invalidated', async () => {
    const view = observed({ key: 'd', fn: async () => 1 }, 'static')
    await settle()
    expect(view.result.current.freshness.fetch).toBe('fresh')
    await act(
      async () => void (await client.invalidateQueries({ queryKey: ['d'], refetchType: 'none' })),
    )
    expect(view.result.current.freshness.fetch).toBe('stale')
  })

  test('the view is the same object until something changes', async () => {
    const view = observed({ key: 'e', fn: async () => 1 })
    await settle()
    const before = view.result.current.freshness
    view.rerender()
    expect(view.result.current.freshness).toBe(before)
  })

  test('no keys reads every active query', async () => {
    const view = renderHook(
      () => {
        useQuery(liveQuery({ queryKey: ['g1'], queryFn: async () => 1 }, 'standard'))
        useQuery(
          liveQuery(
            { queryKey: ['g2'], queryFn: () => Promise.reject(new Error('down')) },
            'standard',
          ),
        )
        return useFreshness()
      },
      { wrapper },
    )
    await settle()
    expect(view.result.current.fetch).toBe('error')
    expect(view.result.current.button.error).toBe('down')
  })
})

describe('source', () => {
  beforeEach(() => jest.useFakeTimers({ now: 10_000_000 }))
  afterEach(() => jest.useRealTimers())

  const withSource = (at: number | undefined, maxAge?: number) => {
    client.setQueryData(['s'], { at })
    return renderHook(
      () => {
        useQuery({ queryKey: ['s'], queryFn: async () => ({ at }), staleTime: Infinity })
        return useFreshness([['s']], {
          source: (data) => (data as { at?: number }).at,
          ...(maxAge !== undefined && { sourceMaxAge: maxAge }),
        })
      },
      { wrapper },
    )
  }

  test('fresh inside the max age, stale after, absent without a timestamp', () => {
    const view = withSource(10_000_000 - 1_000, 60_000)
    expect(view.result.current.source).toBe('fresh')
    act(() => void jest.advanceTimersByTime(FRESHNESS_TICK_MS * 3))
    expect(view.result.current.source).toBe('stale')
    cleanup()
    client.clear()
    expect(withSource(undefined, 60_000).result.current.source).toBe('absent')
  })

  test('no source option, no source verdict', () => {
    client.setQueryData(['n'], 1)
    const view = renderHook(
      () => {
        useQuery({ queryKey: ['n'], queryFn: async () => 1, staleTime: Infinity })
        return useFreshness([['n']])
      },
      { wrapper },
    )
    expect(view.result.current.source).toBeUndefined()
  })
})
