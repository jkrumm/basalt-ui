/**
 * `basaltRouterOptions` — the factory a router the app builds itself (TanStack Start's
 * `getRouter()`) spreads, so it gets everything `createBasaltRouter` sets (provider-01/10).
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRouteWithContext,
  createRouter,
} from '@tanstack/react-router'
import { renderToString } from 'react-dom/server'
import { BasaltProvider } from './index'
import { basaltRouterOptions, createBasaltRouter } from './create-router'
import type { BasaltRouterContext } from './create-router'
import { queryClientOf } from './test-router'
import type { BasaltEvent } from '../telemetry'

afterEach(cleanup)

const sink = (events: BasaltEvent[]) => (e: BasaltEvent) => void events.push(e)

/** A Start-shaped app: the app's own router, the provider INSIDE it around the `<Outlet />`. */
function embedded(events: BasaltEvent[]) {
  const root = createRootRouteWithContext<BasaltRouterContext>()({
    component: () => (
      <BasaltProvider telemetry={sink(events)}>
        <div>embedded</div>
        <Outlet />
      </BasaltProvider>
    ),
  })
  return createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
    ...basaltRouterOptions(),
  })
}

describe('basaltRouterOptions', () => {
  test('carries every default createBasaltRouter owns, on a plain createRouter', () => {
    const router = embedded([])
    expect(router.options.defaultPreload).toBe('intent')
    expect(router.options.defaultPreloadStaleTime).toBe(0)
    expect(router.options.scrollRestoration).toBe(true)
    expect(router.options.defaultPendingComponent).toBeDefined()
    expect(router.options.defaultErrorComponent).toBeDefined()
    expect(router.options.defaultNotFoundComponent).toBeDefined()
    expect(queryClientOf(router).getDefaultOptions().queries?.staleTime).toBe(30_000)
  })

  test('`query` and `context` thread through; a call makes one QueryClient', () => {
    const a = basaltRouterOptions({
      query: { defaultOptions: { queries: { staleTime: 1 } } },
      context: { auth: 'token' },
    })
    expect(a.context).toMatchObject({ auth: 'token' })
    expect(a.context.queryClient.getDefaultOptions().queries?.staleTime).toBe(1)
    expect(basaltRouterOptions().context.queryClient).not.toBe(a.context.queryClient)
  })

  test('route.error reaches the sink without createBasaltRouter', async () => {
    const quiet = spyOn(console, 'error').mockImplementation(() => {})
    const events: BasaltEvent[] = []
    const router = embedded(events)
    render(<RouterProvider router={router} />)
    await screen.findByText('embedded')

    router.options.defaultOnCatch?.(new TypeError('private detail'), {} as never)
    quiet.mockRestore()

    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'route.error',
      failed: true,
      attributes: { 'exception.type': 'TypeError', 'basalt.error.kind': 'route' },
    })
    expect(JSON.stringify(events[0])).not.toContain('private detail')
  })

  test('no provider mounted, no events — and no throw', () => {
    const quiet = spyOn(console, 'error').mockImplementation(() => {})
    const router = embedded([])
    expect(() => router.options.defaultOnCatch?.(new Error('x'), {} as never)).not.toThrow()
    quiet.mockRestore()
  })

  test('createBasaltRouter is the factory plus the brand', () => {
    const root = createRootRouteWithContext<BasaltRouterContext>()()
    const router = createBasaltRouter({ routeTree: root })
    expect(router.options.defaultPreload).toBe('intent')
    expect(typeof queryClientOf(router).getQueryCache).toBe('function')
  })

  test('history and basepath pass through createBasaltRouter; managed keys stay unwritable', () => {
    const root = createRootRouteWithContext<BasaltRouterContext>()()
    const history = createMemoryHistory({ initialEntries: ['/x'] })
    const router = createBasaltRouter({ routeTree: root, history, basepath: '/app' })
    expect(router.history).toBe(history)
    expect(router.options.basepath).toBe('/app')
    // @ts-expect-error `defaultOnCatch` is basalt's (the route.error emitter)
    createBasaltRouter({ routeTree: root, defaultOnCatch: () => {} })
    // @ts-expect-error `defaultPreload` is basalt's
    createBasaltRouter({ routeTree: root, defaultPreload: false })
    // @ts-expect-error `scrollRestoration` is basalt's
    createBasaltRouter({ routeTree: root, scrollRestoration: false })
  })

  test('server HTML of a tree under the factory-built router equals the first client render', async () => {
    const make = () => {
      const root = createRootRouteWithContext<BasaltRouterContext>()({
        component: () => (
          <BasaltProvider>
            <div>ssr parity</div>
            <Outlet />
          </BasaltProvider>
        ),
      })
      return createRouter({
        routeTree: root,
        history: createMemoryHistory({ initialEntries: ['/'] }),
        ...basaltRouterOptions(),
      })
    }
    const server = make()
    await server.load()
    const html = renderToString(<RouterProvider router={server} />)

    const client = make()
    await client.load()
    const container = document.createElement('div')
    document.body.append(container)
    // `hydrateRoot` would warn on any mismatch; the first client render as HTML is the same check.
    container.innerHTML = renderToString(<RouterProvider router={client} />)
    expect(container.innerHTML).toBe(html)
    container.remove()
  })
})
