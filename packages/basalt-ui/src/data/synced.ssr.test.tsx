/**
 * `createSyncedState` under SSR: importing the module and defining a state start no timer,
 * listener or fetch; the server renders the Query value or `initial`, never the mirror; hydration
 * reports zero recoverable errors and then shows the mirror. A negative control proves the counter
 * can fail.
 */
import { act, cleanup } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { makeQueryClient } from './query-client'

type Prefs = { theme: string }
const accept = { '~standard': { validate: (value: unknown) => ({ value: value as Prefs }) } }
const never = { load: () => new Promise<never>(() => {}), save: () => new Promise<never>(() => {}) }

beforeEach(() => localStorage.clear())
afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
})

const define = async (key: string) => {
  const { createSyncedState } = await import('./synced')
  return createSyncedState({
    key,
    version: 1,
    schema: accept,
    initial: { theme: 'initial' },
    owner: () => 'u1',
    transport: never,
  })
}

const mirror = (key: string, theme: string): void =>
  localStorage.setItem(`basalt:u1:${key}`, JSON.stringify({ v: 1, value: { theme }, rev: null }))

async function hydrate(html: string, element: React.ReactElement) {
  const container = document.createElement('div')
  container.innerHTML = html
  document.body.append(container)
  let errors = 0
  await act(async () => {
    hydrateRoot(container, element, { onRecoverableError: () => void (errors += 1) })
  })
  return { errors, container }
}

/** Reads the mirror straight in render: the server and the first client render disagree. */
const Naive = () => (
  <span>{localStorage.getItem('basalt:u1:control') === null ? 'server' : 'client'}</span>
)

const withClient = (client: QueryClient, node: React.ReactElement) => (
  <QueryClientProvider client={client}>{node}</QueryClientProvider>
)

describe('createSyncedState — SSR', () => {
  test('import and definition are inert: no timer, listener or fetch', async () => {
    const timers = spyOn(globalThis, 'setTimeout')
    const windowListeners = spyOn(globalThis, 'addEventListener')
    const documentListeners = spyOn(document, 'addEventListener')
    const fetches = spyOn(globalThis, 'fetch')
    try {
      await define('inert')
      expect(timers).not.toHaveBeenCalled()
      expect(windowListeners).not.toHaveBeenCalled()
      expect(documentListeners).not.toHaveBeenCalled()
      expect(fetches).not.toHaveBeenCalled()
    } finally {
      timers.mockRestore()
      windowListeners.mockRestore()
      documentListeners.mockRestore()
      fetches.mockRestore()
    }
  })

  test('the server renders the Query value, else initial; never the mirror', async () => {
    const prefs = await define('server')
    mirror('server', 'mirror')
    const View = () => <span>{prefs.use().value.theme}</span>
    expect(renderToString(withClient(makeQueryClient(), <View />))).toContain('initial')
    const dehydrated = makeQueryClient()
    dehydrated.setQueryData(['basalt', 'synced', 'server', 'u1'], {
      value: { theme: 'query' },
      rev: '7',
    })
    expect(renderToString(withClient(dehydrated, <View />))).toContain('query')
  })

  test('hydration has zero recoverable errors, then shows the mirror', async () => {
    const prefs = await define('hydrate')
    const View = () => <span>{prefs.use().value.theme}</span>
    const html = renderToString(withClient(makeQueryClient(), <View />))
    mirror('hydrate', 'mirror')
    const { errors, container } = await hydrate(html, withClient(makeQueryClient(), <View />))
    expect(errors).toBe(0)
    expect(container.textContent).toBe('mirror')
  })

  test('negative control: reading the mirror in render raises recoverable errors', async () => {
    const html = renderToString(<Naive />)
    mirror('control', 'mirror')
    const { errors } = await hydrate(html, <Naive />)
    expect(errors).toBeGreaterThan(0)
  })
})
