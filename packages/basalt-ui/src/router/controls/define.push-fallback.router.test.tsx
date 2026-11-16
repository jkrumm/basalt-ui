/**
 * A push enum written back to its fallback through `use()`'s setter leaves the URL and still pushes
 * an entry (`ViewTabs` on its default); `choose()` keeps the fallback (`InnerNav`'s pane choice).
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { act, cleanup, render } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { defineControls, resetControlsOwnersForTests } from './define'
import { field } from './field'

afterEach(cleanup)
beforeEach(resetControlsOwnersForTests)

describe('defineControls: a push enum at its fallback', () => {
  test('a push enum set back to its fallback leaves the URL and still pushes; choose() keeps it', async () => {
    const store = defineControls({
      id: 'push-fallback',
      scope: 'page',
      fields: {
        view: field.enum(['table', 'chart'], 'table', { history: 'push' }),
      },
    })
    const handle: { set?: (v: 'table' | 'chart') => void } = {}
    const history = createMemoryHistory({ initialEntries: ['/v?view=chart'] })
    const root = createRootRoute({
      component: () => {
        handle.set = store.field.view.use()[1]
        return createElement(Outlet)
      },
    })
    const v = createRoute({
      getParentRoute: () => root,
      path: '/v',
      validateSearch: store.validateSearch,
      search: { middlewares: store.middlewares },
    })
    const router = createRouter({ routeTree: root.addChildren([v]), history })
    await router.load()
    render(createElement(RouterProvider as never, { router }))
    const length = history.length
    await act(async () => {
      handle.set?.('table')
      await router.load()
    })
    expect(router.state.location.href).toBe('/v')
    expect(history.length).toBe(length + 1)
    await act(async () => {
      store.field.view.choose('table')
      await router.load()
    })
    expect(router.state.location.href).toBe('/v?view=table')
    expect(history.length).toBe(length + 2)
  })
})
