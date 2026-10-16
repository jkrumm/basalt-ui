/**
 * `basaltRouterOptions` — the factory a router the app builds itself (TanStack Start's
 * `getRouter()`) spreads, so it gets everything `createBasaltRouter` sets (provider-01/10).
 */
import { act, cleanup, render, screen } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRootRouteWithContext,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { hydrateRoot } from 'react-dom/client'
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

  test('a loader that throws under a mounted provider emits exactly one route.error', async () => {
    const quiet = spyOn(console, 'error').mockImplementation(() => {})
    const events: BasaltEvent[] = []
    const root = createRootRoute({ component: Outlet })
    const boom = createRoute({
      getParentRoute: () => root,
      path: '/',
      loader: () => {
        throw new RangeError('secret loader detail')
      },
      component: () => null,
    })
    const router = createBasaltRouter({
      routeTree: root.addChildren([boom]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    render(<BasaltProvider router={router} telemetry={sink(events)} />)
    await screen.findByText('Something went wrong')
    quiet.mockRestore()
    const routeErrors = events.filter((e) => e.type === 'route.error')
    expect(routeErrors).toHaveLength(1)
    expect(routeErrors[0]).toMatchObject({ attributes: { 'exception.type': 'RangeError' } })
    expect(JSON.stringify(routeErrors)).not.toContain('secret loader detail')
  })

  test('an error with no bound handler still reaches the console, in production too', () => {
    const env = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const log = spyOn(console, 'error').mockImplementation(() => {})
    try {
      embedded([]).options.defaultOnCatch?.(new Error('early'), {} as never)
      expect(log).toHaveBeenCalledTimes(1)
    } finally {
      log.mockRestore()
      process.env.NODE_ENV = env ?? 'test'
    }
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

  test('a required-context type must be supplied; the empty case stays optional', () => {
    type Auth = { auth: string }
    basaltRouterOptions()
    basaltRouterOptions({ query: {} })
    basaltRouterOptions<Auth>({ context: { auth: 't' } })
    // @ts-expect-error `Auth` has a required key, so `context` is required
    basaltRouterOptions<Auth>()
    // @ts-expect-error `context` is required too once `query` is given
    basaltRouterOptions<Auth>({ query: {} })
    // @ts-expect-error `queryClient` is basalt's: a consumer's would be silently replaced
    basaltRouterOptions({ context: { queryClient: new QueryClient() } })
  })

  test('basalt wins every managed key even when a cast-through consumer passes one', () => {
    const root = createRootRouteWithContext<BasaltRouterContext>()()
    const own = new QueryClient()
    const consumerCatch = mock(() => {})
    const sneaky = {
      defaultPreload: false,
      defaultOnCatch: consumerCatch,
      context: { queryClient: own },
    } as object
    const router = createBasaltRouter({ routeTree: root, ...sneaky })
    expect(router.options.defaultPreload).toBe('intent')
    expect(router.options.defaultOnCatch).not.toBe(consumerCatch)
    const quiet = spyOn(console, 'error').mockImplementation(() => {})
    router.options.defaultOnCatch?.(new Error('x'), {} as never)
    quiet.mockRestore()
    expect(consumerCatch).not.toHaveBeenCalled()

    const { context } = basaltRouterOptions({ context: { queryClient: own } as never })
    expect(context.queryClient).not.toBe(own)
  })

  test('the first client render hydrates the server HTML without a mismatch', async () => {
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
    container.innerHTML = html
    const errors = spyOn(console, 'error').mockImplementation(() => {})
    const recoverable: unknown[] = []
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, <RouterProvider router={client} />, {
        onRecoverableError: (error) => void recoverable.push(error),
      })
    })
    const logged = errors.mock.calls.map(String)
    errors.mockRestore()
    await act(async () => root?.unmount())
    container.remove()
    // `renderToString` cannot render the dev dock's Suspense boundary, so React re-renders just that
    // boundary on the client and says so; every other recoverable error is a real mismatch.
    const mismatches = recoverable
      .map(String)
      .filter((m) => !/Switched to client rendering/.test(m))
    expect(mismatches).toEqual([])
    expect(logged.filter((m) => /hydrat|mismatch/i.test(m))).toEqual([])
  })
})
