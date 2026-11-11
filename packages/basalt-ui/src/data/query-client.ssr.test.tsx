/** No module-level QueryClient: two renders of an app each build their own (SSR per request). */
import { describe, expect, test } from 'bun:test'
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { renderToString } from 'react-dom/server'
import { makeQueryClient } from './query-client'

const seen: unknown[] = []

function Probe() {
  seen.push(useQueryClient())
  return <p>ok</p>
}

const render = () => {
  const client = makeQueryClient()
  renderToString(
    <QueryClientProvider client={client}>
      <Probe />
    </QueryClientProvider>,
  )
  return client
}

describe('makeQueryClient — SSR', () => {
  test('two renders never share a client or its cache', () => {
    const first = render()
    first.setQueryData(['k'], 'first request')
    const second = render()
    expect(seen[0]).toBe(first)
    expect(seen[1]).toBe(second)
    expect(first).not.toBe(second)
    expect(second.getQueryData(['k'])).toBeUndefined()
  })

  test('the module exports no client instance', async () => {
    const mod = await import('./query-client')
    expect(Object.values(mod).some((value) => typeof value === 'object' && value !== null)).toBe(
      false,
    )
  })
})
