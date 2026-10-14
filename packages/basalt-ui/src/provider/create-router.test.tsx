import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { createRootRoute } from '@tanstack/react-router'
import { createBasaltRouter } from './create-router'
import { routeViewTransition, supportsViewTransitionTypes } from './route-transition'
import { queryClientOf } from './test-router'
import { bindRouterTelemetry } from '../telemetry'
import type { BasaltEvent } from '../telemetry'

const routeTree = createRootRoute()

describe('createBasaltRouter defaults (V2-SPEC § 2)', () => {
  const router = createBasaltRouter({ routeTree })

  test('router options', () => {
    expect(router.options.defaultPreload).toBe('intent')
    // Query owns freshness.
    expect(router.options.defaultPreloadStaleTime).toBe(0)
    expect(router.options.scrollRestoration).toBe(true)
    expect(router.options.defaultPendingComponent).toBeDefined()
    expect(router.options.defaultErrorComponent).toBeDefined()
    expect(router.options.defaultNotFoundComponent).toBeDefined()
    expect(router.options.defaultOnCatch).toBeDefined()
  })

  test('the QueryClient carries the 1.x defaults on context', () => {
    const client = queryClientOf(router)
    expect(client.getDefaultOptions().queries).toEqual({
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    })
  })

  test('`query` merges over the defaults and `context` rides beside queryClient', () => {
    const custom = createBasaltRouter({
      routeTree,
      context: { auth: 'token' },
      query: { defaultOptions: { queries: { staleTime: 1, retry: 0 } } },
    })
    expect(custom.options.context).toMatchObject({ auth: 'token' })
    expect(queryClientOf(custom).getDefaultOptions().queries).toMatchObject({
      staleTime: 1,
      retry: 0,
      gcTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    })
  })

  test('one QueryClient per call', () => {
    const other = createBasaltRouter({ routeTree })
    expect(queryClientOf(other)).not.toBe(queryClientOf(router))
  })

  test('defaultOnCatch emits route.error with the error name and no message once a provider is bound', () => {
    const quiet = spyOn(console, 'error').mockImplementation(() => {})
    const events: BasaltEvent[] = []
    const unbind = bindRouterTelemetry(router, (e) => events.push(e))
    router.options.defaultOnCatch?.(new TypeError('private detail'), {} as never)
    unbind()
    router.options.defaultOnCatch?.(new TypeError('after unbind'), {} as never)
    quiet.mockRestore()
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: 'route.error',
      failed: true,
      attributes: { 'exception.type': 'TypeError', 'basalt.error.kind': 'route' },
    })
    expect(JSON.stringify(events[0])).not.toContain('private detail')
  })
})

describe('createBasaltRouter view transition (V2-SPEC § 5)', () => {
  const realCss = Object.getOwnPropertyDescriptor(window, 'CSS')
  const withSupports = (supports: ((q: string) => boolean) | undefined) =>
    Object.defineProperty(window, 'CSS', { value: supports && { supports }, configurable: true })
  afterEach(() => {
    if (realCss) Object.defineProperty(window, 'CSS', realCss)
    else delete (window as { CSS?: unknown }).CSS
  })

  test('with :active-view-transition-type() support the router carries the route transition', () => {
    const asked: string[] = []
    withSupports((q) => (asked.push(q), true))
    expect(createBasaltRouter({ routeTree }).options.defaultViewTransition).toBe(
      routeViewTransition,
    )
    expect(asked).toEqual(['selector(:active-view-transition-type(a))'])
  })

  test('without support, or without CSS.supports, there is no route transition', () => {
    withSupports(() => false)
    expect(createBasaltRouter({ routeTree }).options.defaultViewTransition).toBe(false)
    withSupports(undefined)
    expect(createBasaltRouter({ routeTree }).options.defaultViewTransition).toBe(false)
  })

  test('on the server (no window) there is no route transition', () => {
    const win = globalThis.window
    // @ts-expect-error simulating a server
    delete globalThis.window
    try {
      expect(supportsViewTransitionTypes()).toBe(false)
    } finally {
      globalThis.window = win
    }
  })

  test('two routers install the guard once: one catch per promise per start', () => {
    withSupports(() => true)
    const original = Object.getOwnPropertyDescriptor(document, 'startViewTransition')
    const catches = { ready: 0, finished: 0 }
    const promiseFor = (key: keyof typeof catches) => ({ catch: () => void catches[key]++ })
    document.startViewTransition = (() => ({
      ready: promiseFor('ready'),
      finished: promiseFor('finished'),
      updateCallbackDone: promiseFor('ready'),
    })) as never
    try {
      createBasaltRouter({ routeTree })
      createBasaltRouter({ routeTree })
      document.startViewTransition(() => {})
      expect(catches).toEqual({ ready: 1, finished: 1 })
    } finally {
      if (original) Object.defineProperty(document, 'startViewTransition', original)
      else delete (document as { startViewTransition?: unknown }).startViewTransition
    }
  })

  test('the option is not a consumer knob', () => {
    // @ts-expect-error one way to do it: `defaultViewTransition` is not an option
    createBasaltRouter({ routeTree, defaultViewTransition: false })
  })
})
