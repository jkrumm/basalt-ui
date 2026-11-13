/**
 * P4 (live-realtime 7): `renderToString` then `hydrateRoot` over `useConnection`, `useFreshness`,
 * `ConnectionIndicator`, `RefreshButton` and a `liveQuery` page: the server starts no timer and
 * no fetch, and hydration raises no recoverable error and no mismatch warning. A negative control
 * proves the counters can fail.
 */
import { QueryClientProvider, queryOptions, useQuery } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { act, cleanup } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { ConnectionIndicator } from '../../page/connection-indicator'
import { RefreshButton } from '../../page/refresh-button'
import { useConnection } from './connection'
import { useFreshness } from './freshness'
import { liveQuery } from './live-query'
import { makeQueryClient } from '../query-client'

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

const usage = () =>
  liveQuery(
    queryOptions({
      queryKey: ['usage'],
      queryFn: async () => ({ total: 3 }),
    }),
    'static',
  )

function LivePage() {
  const connection = useConnection()
  const freshness = useFreshness([['usage']], {
    source: () => Date.now() - 1_000,
    sourceMaxAge: 60_000,
  })
  const { data } = useQuery(usage())
  return (
    <main>
      <ConnectionIndicator connection={connection} />
      <RefreshButton scope="page" {...freshness.button} />
      <output>{data?.total ?? 'none'}</output>
      <output>{freshness.fetch}</output>
    </main>
  )
}

const seeded = (): QueryClient => {
  const client = makeQueryClient()
  client.setQueryData(['usage'], { total: 3 }, { updatedAt: Date.now() - 5 * 60_000 })
  return client
}

const tree = (client: QueryClient) => (
  <QueryClientProvider client={client}>
    <LivePage />
  </QueryClientProvider>
)

async function hydrate(html: string, element: React.ReactElement) {
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.append(container)
  const errors: unknown[] = []
  const logged = spyOn(console, 'error').mockImplementation((...args) => void errors.push(args))
  await act(async () => {
    hydrateRoot(container, element, { onRecoverableError: (e) => void errors.push(e) })
  })
  logged.mockRestore()
  return { errors, container }
}

describe('live views under SSR (P4)', () => {
  test('the server render starts no timer and no fetch, and carries no age', () => {
    const client = seeded()
    const timeouts = spyOn(globalThis, 'setTimeout')
    const intervals = spyOn(globalThis, 'setInterval')
    const fetches = spyOn(globalThis, 'fetch')
    try {
      const html = renderToString(tree(client))
      expect(timeouts).not.toHaveBeenCalled()
      expect(intervals).not.toHaveBeenCalled()
      expect(fetches).not.toHaveBeenCalled()
      expect(html).toContain('Polling')
      expect(html).not.toContain('ago')
      expect(html).toContain('<output>3</output>')
    } finally {
      timeouts.mockRestore()
      intervals.mockRestore()
      fetches.mockRestore()
    }
  })

  test('hydration has zero recoverable errors and no mismatch warning, then shows the age', async () => {
    const html = renderToString(tree(seeded()))
    const { errors, container } = await hydrate(html, tree(seeded()))
    expect(errors).toEqual([])
    expect(container.textContent).toContain('5 minutes ago')
  })

  test('negative control: an age read from the clock in render raises a mismatch', async () => {
    let renders = 0
    const Naive = () => <span>{renders++}</span>
    const html = renderToString(<Naive />)
    const { errors } = await hydrate(html, <Naive />)
    expect(errors.length).toBeGreaterThan(0)
  })
})
