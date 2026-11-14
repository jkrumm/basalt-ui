import { describe, expect, test } from 'bun:test'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { routeTransitionTypes, routerDefaults } from './defaults'
import { registerNav } from './nav/registry'
import { defineNav } from '../../tests/support/router-nav'

const NAV = defineNav({
  sections: [
    {
      id: 's',
      label: 'S',
      items: [
        { id: 'one', label: 'One', link: { to: '/one' } },
        { id: 'two', label: 'Two', link: { to: '/two' } },
      ],
    },
  ],
})

const change = (from: string | undefined, to: string, pathChanged = true) => ({
  fromLocation: from === undefined ? undefined : { pathname: from },
  toLocation: { pathname: to },
  pathChanged,
})

describe('routerDefaults().options', () => {
  const { options } = routerDefaults()

  test('is a plain object: Object.prototype, no symbol keys, no brand', () => {
    expect(Object.getPrototypeOf(options)).toBe(Object.prototype)
    expect(Object.getOwnPropertySymbols(options)).toEqual([])
    expect(Object.keys(options)).not.toContain('__brand')
  })

  test('holds the five timing, preload and scroll defaults', () => {
    expect(options).toMatchObject({
      defaultPreload: 'intent',
      defaultPreloadStaleTime: 0,
      defaultPendingMs: 300,
      defaultPendingMinMs: 300,
      defaultStructuralSharing: true,
      scrollRestoration: true,
      scrollToTopSelectors: ['[data-scroll-restoration-id]'],
    })
  })

  test('sets none of the three route components (they are the app files)', () => {
    for (const key of [
      'defaultPendingComponent',
      'defaultErrorComponent',
      'defaultNotFoundComponent',
    ])
      expect(options).not.toHaveProperty(key)
  })

  test('createRouter takes it and keeps the values', () => {
    const root = createRootRoute()
    const router = createRouter({
      routeTree: root.addChildren([createRoute({ getParentRoute: () => root, path: '/' })]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
      ...options,
    })
    expect(router.options.defaultPendingMs).toBe(300)
    expect(router.options.defaultPreload).toBe('intent')
    expect(RouterProvider).toBeDefined()
  })

  test('each call is a fresh object', () => {
    expect(routerDefaults().options).not.toBe(options)
  })
})

describe('route transition types', () => {
  test('none on first load or when only search or hash changed', () => {
    expect(routeTransitionTypes(change(undefined, '/one'), undefined)).toBe(false)
    expect(routeTransitionTypes(change('/one', '/one', false), undefined)).toBe(false)
  })

  test('without a registered nav every path change is a sibling crossfade', () => {
    expect(routeTransitionTypes(change('/one', '/two'), undefined)).toEqual(['basalt-sibling'])
    expect(routeTransitionTypes(change('/one', '/two'), {})).toEqual(['basalt-sibling'])
  })

  test('direction follows the order of the registered nav', () => {
    const router = {}
    registerNav(router, NAV)
    expect(routeTransitionTypes(change('/one', '/two'), router)).toEqual(['basalt-forward'])
    expect(routeTransitionTypes(change('/two', '/one'), router)).toEqual(['basalt-back'])
    expect(routeTransitionTypes(change('/one', '/elsewhere'), router)).toEqual(['basalt-sibling'])
  })

  test('the thunk reads the router at navigation time, not at build time', () => {
    const win = globalThis as { window?: unknown }
    const had = win.window
    win.window = { CSS: { supports: () => true } }
    try {
      let router: object | undefined
      const { options } = routerDefaults({ router: () => router })
      const vt = options.defaultViewTransition
      if (vt === false) throw new Error('expected a view transition')
      expect(vt.types(change('/one', '/two'))).toEqual(['basalt-sibling'])
      router = {}
      registerNav(router, NAV)
      expect(vt.types(change('/one', '/two'))).toEqual(['basalt-forward'])
    } finally {
      if (had === undefined) delete win.window
      else win.window = had
    }
  })

  test('no view transition where the browser lacks type selectors', () => {
    const win = globalThis as { window?: unknown }
    const had = win.window
    win.window = { CSS: { supports: () => false } }
    try {
      expect(routerDefaults().options.defaultViewTransition).toBe(false)
    } finally {
      if (had === undefined) delete win.window
      else win.window = had
    }
  })
})
