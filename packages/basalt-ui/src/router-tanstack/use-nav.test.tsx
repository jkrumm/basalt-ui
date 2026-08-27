/**
 * `useNav`'s active-resolution pass, under a REAL TanStack memory router — the half that cannot be
 * tested headlessly (`matchRoute`/`useRouterState` both need a live router). The fixture below
 * mirrors every collision shape the playground's own `demo/nav-model.tsx` actually has: a root `/`
 * item, a `/dashboard` parent with three children, flat siblings, a same-path duplicate
 * (`reports`/`components`, mirroring the playground's disabled-placeholder shape), and a
 * search-bearing link (mirroring `dashboardFilters.linkSearch`-style destinations).
 *
 * The harness is modeled on `controls/controls.router.test.tsx`'s `mountPage`, narrowed to a
 * headless probe: `useNav` renders no JSX itself (`./router-tanstack` is a no-JSX barrel), so the
 * probe component only reads its return value into a sink — no `MantineProvider` needed.
 */
import { cleanup, render, waitFor } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { SidebarItem, SidebarSection } from '../nav/types'
import type { AnyNavItem } from './nav'
import { defineNav, navGroup } from './nav'
import { useNav } from './use-nav'

const NAV = defineNav({
  groups: [
    navGroup({ id: 'main', label: 'Main' }, [
      { id: 'home', label: 'Home', link: { to: '/' } },
      {
        id: 'dashboard',
        label: 'Dashboard',
        // A store-backed destination (law C10's shape) — `search` rides the link like every
        // other field; `matchOf` below never reads it, so it must not affect matching either.
        link: { to: '/dashboard', search: { window: '30d' } },
        children: [
          { id: 'dashboard-sessions', label: 'Sessions', link: { to: '/dashboard/sessions' } },
          { id: 'dashboard-traffic', label: 'Traffic', link: { to: '/dashboard/traffic' } },
          { id: 'dashboard-revenue', label: 'Revenue', link: { to: '/dashboard/revenue' } },
        ],
      },
      { id: 'mobile-nav-pill', label: 'Mobile nav pill', link: { to: '/mobile-nav-pill' } },
      {
        id: 'controls-mobile',
        label: 'Controls (mobile)',
        link: { to: '/controls-mobile' },
      },
      { id: 'components', label: 'Components', link: { to: '/components' } },
      { id: 'charts-page', label: 'Charts', link: { to: '/charts' } },
      // The playground's `reports` shape: a disabled placeholder that deliberately borrows an
      // already-covered route rather than inventing one. Declared AFTER `components`, so the
      // definition-order tie-break keeps `components` the winner at `/components`.
      { id: 'reports', label: 'Reports', disabled: true, link: { to: '/components' } },
    ]),
  ],
})

const ROUTE_PATHS = [
  '/',
  '/dashboard',
  '/dashboard/sessions',
  '/dashboard/traffic',
  '/dashboard/revenue',
  '/mobile-nav-pill',
  '/controls-mobile',
  '/components',
  '/charts',
]

type NavProbeOpts = { isActive?: (item: AnyNavItem) => boolean }
type NavResult = { sections: SidebarSection[] }
type Sink = { current: NavResult | null }

/** Depth-first flatten of the rendered `SidebarSection[]` — the same shape every downstream reader
 * (the sidebar, the mobile bar, the breadcrumb) walks. */
function flattenItems(sections: SidebarSection[]): SidebarItem[] {
  const out: SidebarItem[] = []
  const walk = (items: SidebarItem[]): void => {
    for (const item of items) {
      out.push(item)
      if (item.children) walk(item.children)
    }
  }
  for (const section of sections) walk(section.items)
  return out
}

async function mountNav(entry: string, opts?: NavProbeOpts): Promise<Sink> {
  const sink: Sink = { current: null }

  function NavProbe(): ReactNode {
    const nav = useNav(NAV, opts)
    sink.current = { sections: nav.sections }
    return null
  }

  const rootRoute = createRootRoute({
    component: () => (
      <>
        <NavProbe />
        <Outlet />
      </>
    ),
  })
  const children = ROUTE_PATHS.map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
  )
  const router = createRouter({
    routeTree: rootRoute.addChildren(children),
    history: createMemoryHistory({ initialEntries: [entry] }),
  })

  render(<RouterProvider router={router} />)
  await waitFor(() => {
    expect(router.state.status).toBe('idle')
  })
  return sink
}

describe('useNav — exclusivity', () => {
  test('exactly one row is active at every route in the definition', async () => {
    for (const path of ROUTE_PATHS) {
      const sink = await mountNav(path)
      const items = flattenItems(sink.current!.sections)
      const activeCount = items.filter((item) => item.active).length
      expect(activeCount).toBe(1)
      cleanup()
    }
  })

  test('the deepest match wins — a child route does not also light its parent', async () => {
    const sink = await mountNav('/dashboard/sessions')
    const items = flattenItems(sink.current!.sections)
    const dashboard = items.find((item) => item.key === 'dashboard')
    const sessions = items.find((item) => item.key === 'dashboard-sessions')
    expect(dashboard?.active).toBe(false)
    expect(sessions?.active).toBe(true)
  })

  test('the parent of the active row is an ancestor, not active', async () => {
    const sink = await mountNav('/dashboard/sessions')
    const items = flattenItems(sink.current!.sections)
    const dashboard = items.find((item) => item.key === 'dashboard')
    expect(dashboard?.ancestor).toBe(true)
    expect(dashboard?.active).toBe(false)
  })

  test('a same-path duplicate destination is neither active nor an ancestor', async () => {
    const sink = await mountNav('/components')
    const items = flattenItems(sink.current!.sections)
    const components = items.find((item) => item.key === 'components')
    const reports = items.find((item) => item.key === 'reports')
    expect(components?.active).toBe(true)
    expect(reports?.active).toBe(false)
    expect(reports?.ancestor).toBeFalsy()
  })

  test("'/' stays exact — the root never lights on a nested route", async () => {
    const sink = await mountNav('/dashboard')
    const items = flattenItems(sink.current!.sections)
    const home = items.find((item) => item.key === 'home')
    expect(home?.active).toBe(false)
    expect(home?.ancestor).toBeFalsy()
  })

  test('an item whose exact route is never visited still lights on a descendant route', async () => {
    // `/dashboard` itself is never the visited entry in this test — only its descendant is —
    // proving the fix kept `fuzzy: true` as the default rather than flipping every item to exact.
    const sink = await mountNav('/dashboard/traffic')
    const items = flattenItems(sink.current!.sections)
    const dashboard = items.find((item) => item.key === 'dashboard')
    expect(dashboard?.ancestor).toBe(true)
    expect(dashboard?.active).toBe(false)
  })

  test('an isActive override cannot light two rows either', async () => {
    const sink = await mountNav('/', {
      isActive: (item) => item.id === 'components' || item.id === 'charts-page',
    })
    const items = flattenItems(sink.current!.sections)
    const activeCount = items.filter((item) => item.active).length
    expect(activeCount).toBe(1)
  })
})
