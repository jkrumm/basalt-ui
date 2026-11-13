/**
 * `createSyncedState` on a real QueryClient: the load is a `liveQuery`, a save is a mutation in the
 * key's scope that pauses the ticker, the response lands with `setQueryData`, and the session is
 * per client and per owner. The protocol itself is the contract suite's (`synced.contract.test.ts`).
 */
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { QueryClientProvider } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import { isMutationPaused } from './live/live-query-runtime'
import { makeQueryClient } from './query-client'
import { createSyncedState } from './synced'
import type { SyncedRemote, SyncedTransport } from './synced'

type Prefs = { theme: string; rest: number }
const INITIAL: Prefs = { theme: 'light', rest: 90 }
const accept = { '~standard': { validate: (value: unknown) => ({ value: value as Prefs }) } }

beforeEach(() => localStorage.clear())
afterEach(cleanup)

function fakeTransport(server: Prefs) {
  const saves: { patch: Partial<Prefs>; resolve: () => void }[] = []
  let rev = 0
  const transport: SyncedTransport<Prefs> = {
    load: async () => ({ value: server, rev: String(rev) }),
    save: (patch) =>
      new Promise((resolve) => {
        saves.push({
          patch,
          resolve: () => {
            rev += 1
            resolve({ value: { ...server, ...patch }, rev: String(rev) })
          },
        })
      }),
  }
  return { transport, saves }
}

function mount(client: QueryClient, view: () => React.ReactElement) {
  function View() {
    return view()
  }
  return render(
    <QueryClientProvider client={client}>
      <View />
    </QueryClientProvider>,
  )
}

describe('createSyncedState — Query binding', () => {
  test('a save is a scoped mutation that pauses the ticker; its result lands in the cache', async () => {
    const { transport, saves } = fakeTransport({ theme: 'dark', rest: 60 })
    const prefs = createSyncedState({
      key: 'prefs',
      version: 1,
      schema: accept,
      initial: INITIAL,
      owner: () => 'u1',
      transport,
      freshness: { class: 'ticker', every: 5_000 },
      debounceMs: 0,
    })
    const client = makeQueryClient()
    let api: ReturnType<typeof prefs.use> | null = null
    const { container } = mount(client, () => {
      api = prefs.use()
      return <span>{`${api.value.theme}/${api.value.rest}/${api.status}`}</span>
    })
    await waitFor(() => expect(container.textContent).toBe('dark/60/saved'))
    act(() => api?.set({ rest: 120 }))
    await waitFor(() => expect(saves).toHaveLength(1))
    const mutationKey = ['basalt', 'synced', 'prefs', 'u1']
    const query = client.getQueryCache().find({ queryKey: mutationKey, exact: true })
    expect(client.isMutating({ mutationKey })).toBe(1)
    expect(client.getMutationCache().getAll()[0]?.options.scope).toEqual({ id: 'basalt:u1:prefs' })
    await waitFor(() => expect(query && isMutationPaused(query)).toBe(true))
    expect(container.textContent).toBe('dark/120/saving')
    await act(async () => saves[0]?.resolve())
    await waitFor(() => expect(container.textContent).toBe('dark/120/saved'))
    expect(client.isMutating({ mutationKey })).toBe(0)
    expect(client.getQueryData<SyncedRemote<Prefs>>(mutationKey)).toEqual({
      value: { theme: 'dark', rest: 120 },
      rev: '1',
    })
  })

  test('two clients hold two sessions: the definition is shared, the runtime is not', async () => {
    const { transport } = fakeTransport({ theme: 'dark', rest: 60 })
    const prefs = createSyncedState({
      key: 'per-client',
      version: 1,
      schema: accept,
      initial: INITIAL,
      owner: () => null,
      transport,
    })
    const first = makeQueryClient()
    const second = makeQueryClient()
    let one: ReturnType<typeof prefs.use> | null = null
    let two: ReturnType<typeof prefs.use> | null = null
    mount(first, () => {
      one = prefs.use()
      return <span />
    })
    mount(second, () => {
      two = prefs.use()
      return <span />
    })
    act(() => one?.set({ theme: 'first only' }))
    expect(one!.value.theme).toBe('first only')
    expect(two!.value.theme).toBe('light')
  })

  test('an owner switch reads the next owner’s key and drops the unsent edit', async () => {
    const { transport, saves } = fakeTransport({ theme: 'dark', rest: 60 })
    localStorage.setItem(
      'basalt:u2:switch',
      JSON.stringify({ v: 1, value: { theme: 'u2 theme', rest: 30 }, rev: null }),
    )
    let owner = 'u1'
    const prefs = createSyncedState({
      key: 'switch',
      version: 1,
      schema: accept,
      initial: INITIAL,
      owner: () => owner,
      transport: { ...transport, load: () => new Promise<never>(() => {}) },
      debounceMs: 50,
    })
    const client = makeQueryClient()
    let api: ReturnType<typeof prefs.use> | null = null
    const { container, rerender } = mount(client, () => {
      api = prefs.use()
      return <span>{api.value.theme}</span>
    })
    act(() => api?.set({ theme: 'u1 edit' }))
    owner = 'u2'
    rerender(
      <QueryClientProvider client={client}>
        <span />
      </QueryClientProvider>,
    )
    const second = mount(client, () => <span>{prefs.use().value.theme}</span>)
    expect(second.container.textContent).toBe('u2 theme')
    await new Promise((r) => setTimeout(r, 100))
    expect(saves).toHaveLength(0)
    expect(container.textContent).toBe('')
  })

  test('field(k) is [value, set] for one key and stable per key', async () => {
    const { transport } = fakeTransport({ theme: 'dark', rest: 60 })
    const prefs = createSyncedState({
      key: 'field',
      version: 1,
      schema: accept,
      initial: INITIAL,
      owner: () => null,
      transport,
    })
    expect(prefs.field('rest')).toBe(prefs.field('rest'))
    let setRest: ((n: number) => void) | null = null
    const { container } = mount(makeQueryClient(), () => {
      const [rest, set] = prefs.field('rest').use()
      setRest = set
      return <span>{rest}</span>
    })
    expect(container.textContent).toBe('90')
    act(() => setRest?.(45))
    expect(container.textContent).toBe('45')
  })
})
