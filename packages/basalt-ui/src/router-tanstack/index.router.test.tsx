/**
 * `useBasaltNav` under a REAL TanStack memory router — it reads `useLocation`, which needs a live
 * router context, so (like `search-store.router.test.tsx` and `use-nav.test.tsx`) this cannot be
 * tested headlessly. Two-level route tree (`/dashboard` → `/dashboard/detail`): `isActive` stays
 * true on a parent while a nested child is the current route.
 */
import { describe, expect, test } from 'bun:test'
import type { ReactNode } from 'react'
import { render, waitFor } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { useBasaltNav } from './index'

type Sink = { nav: ReturnType<typeof useBasaltNav> | null }

function probe(sink: Sink) {
  return function Probe(): ReactNode {
    sink.nav = useBasaltNav()
    return null
  }
}

/**
 * The probe mounts once, at the ROOT — the hook reads global router state (`useLocation`), not anything scoped to the route the component happens to render under, so one
 * mount sees the full picture regardless of how deep the current match is.
 */
async function mountApp(entry: string, sink: Sink) {
  const Probe = probe(sink)
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Probe />
        <Outlet />
      </>
    ),
  })
  const dashboardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/dashboard',
    staticData: { title: 'Dashboard' },
    component: () => <Outlet />,
  })
  const detailRoute = createRoute({
    getParentRoute: () => dashboardRoute,
    path: 'detail',
    staticData: { title: 'Detail' },
    component: () => null,
  })
  const otherRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/other',
    component: () => null,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([dashboardRoute.addChildren([detailRoute]), otherRoute]),
    history: createMemoryHistory({ initialEntries: [entry] }),
  })

  render(<RouterProvider router={router} />)
  await waitFor(() => {
    expect(router.state.status).toBe('idle')
  })
}

describe('useBasaltNav', () => {
  test('reports the active route, and stays active on a nested child (prefix match)', async () => {
    const sink: Sink = { nav: null }
    await mountApp('/dashboard/detail', sink)

    expect(sink.nav?.currentPath).toBe('/dashboard/detail')
    expect(sink.nav?.isActive('/dashboard/detail')).toBe(true)
    // Parent prefix stays active while a child route is current — the default nav-highlight shape.
    expect(sink.nav?.isActive('/dashboard')).toBe(true)
    expect(sink.nav?.isActive('/other')).toBe(false)
  })

  test('exact mode only matches the current route itself', async () => {
    const sink: Sink = { nav: null }
    await mountApp('/dashboard/detail', sink)

    expect(sink.nav?.isActive('/dashboard', { exact: true })).toBe(false)
    expect(sink.nav?.isActive('/dashboard/detail', { exact: true })).toBe(true)
  })
})
