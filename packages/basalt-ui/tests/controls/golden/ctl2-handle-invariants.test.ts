/** Router-backed 2.x invariants (concept 7): reset, snapshot stability, explicit undefined. */
import { describe, expect, test, spyOn } from 'bun:test'
import { api, handle } from './api'
import { mountRouter } from './harness'

const { defineControls, field } = api

const globals = () =>
  defineControls({
    id: 'globals',
    scope: 'global',
    fields: { range: field.enum(['1h', '24h', '7d'], '24h') },
  })

describe('handle invariants (ctl-2)', () => {
  test.failing('clear() unsets the param; it never writes the fallback', async () => {
    const store = globals()
    let clear = () => {}
    const { router, href } = await mountRouter({
      root: store,
      url: '/a?range=7d',
      probe: () => {
        clear = handle(store, 'range').clear
      },
    })
    expect(router.state.location.search).toMatchObject({ range: '7d' })
    clear()
    await router.load()
    expect(href()).not.toContain('range')
  })

  test.failing('clear() navigates with an explicit undefined, never a deleted key', async () => {
    const store = globals()
    let clear = () => {}
    const { router } = await mountRouter({
      root: store,
      url: '/a?range=7d',
      probe: () => {
        clear = handle(store, 'range').clear
      },
    })
    const navigate = spyOn(router, 'navigate')
    clear()
    const arg = navigate.mock.calls[0]?.[0] as {
      search?: (prev: Record<string, unknown>) => Record<string, unknown>
    }
    const next = arg.search?.({ range: '7d', keep: 1 }) ?? {}
    expect('range' in next).toBe(true)
    expect(next['range']).toBeUndefined()
    expect(next['keep']).toBe(1)
  })

  test.failing('useValues() keeps a stable snapshot across unrelated re-renders', async () => {
    const store = globals()
    const seen: unknown[] = []
    const error = spyOn(console, 'error').mockImplementation(() => {})
    const { go } = await mountRouter({
      root: store,
      url: '/a?range=7d',
      probe: () => {
        seen.push(store.useValues())
      },
    })
    await go('/a', { range: '7d', other: 'x' })
    expect(seen.length).toBeGreaterThan(1)
    expect(new Set(seen).size).toBe(1)
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
})
