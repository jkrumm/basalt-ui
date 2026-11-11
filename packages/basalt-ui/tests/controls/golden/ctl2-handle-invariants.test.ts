/** Router-backed 2.x invariants (concept 7): reset, snapshot stability, explicit undefined. */
import { beforeEach, describe, expect, test, spyOn } from 'bun:test'
import { useRouterState } from '@tanstack/react-router'
import { resetControlsOwnersForTests } from '../../../src/router/controls/define'
import { api, handle } from './api'
import { mountRouter } from './harness'

const { defineControls, field } = api

beforeEach(resetControlsOwnersForTests)

const globals = () =>
  defineControls({
    id: 'globals',
    scope: 'global',
    fields: { range: field.enum(['1h', '24h', '7d'], '24h') },
  })

describe('handle invariants (ctl-2)', () => {
  test('clear() unsets the param; it never writes the fallback', async () => {
    const store = globals()
    let clear = () => {}
    const { router, href } = await mountRouter({
      root: store,
      url: '/a?range=7d',
      // A mounted reader lends the router to `clear()`, which runs from an event handler.
      probe: () => {
        handle(store, 'range').use()
        clear = handle(store, 'range').clear
      },
    })
    expect(router.state.location.search).toMatchObject({ range: '7d' })
    clear()
    await router.load()
    expect(href()).not.toContain('range')
  })

  test('clear() navigates with an explicit undefined, never a deleted key', async () => {
    const store = globals()
    let clear = () => {}
    const { router } = await mountRouter({
      root: store,
      url: '/a?range=7d',
      probe: () => {
        handle(store, 'range').use()
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

  test('useValues() keeps a stable snapshot across unrelated re-renders', async () => {
    const store = globals()
    const seen: unknown[] = []
    const error = spyOn(console, 'error').mockImplementation(() => {})
    // `useValues()` alone does not re-render on an unrelated param; the href read forces one.
    const useProbe = (): void => {
      useRouterState({ select: (s) => s.location.href })
      seen.push(store.useValues())
    }
    const { go } = await mountRouter({ root: store, url: '/a?range=7d', probe: useProbe })
    await go('/a', { range: '7d', other: 'x' })
    expect(seen.length).toBeGreaterThan(1)
    expect(new Set(seen).size).toBe(1)
    expect(error).not.toHaveBeenCalled()
    error.mockRestore()
  })
})
