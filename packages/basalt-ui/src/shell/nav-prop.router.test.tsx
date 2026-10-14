/**
 * `BasaltShell nav={NAV}` under a REAL TanStack memory router: the prop resolves active state
 * (one winner), feeds the breadcrumb and takes typed badges, with no `useNav` spread in the caller.
 * `use-nav.test.tsx` owns the resolver's exclusivity matrix; this pins that the SHELL wires it.
 */
import { MantineProvider } from '@mantine/core'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { navGroup } from '../router-tanstack/nav'
import { defineNav } from '../../tests/support/nav-test-utils'
import { BasaltShell } from './index'

const NAV = defineNav({
  groups: [
    navGroup({ id: 'main', label: 'Main' }, [
      { id: 'home', label: 'Home', link: { to: '/' } },
      {
        id: 'dashboard',
        label: 'Dashboard',
        link: { to: '/dashboard' },
        children: [{ id: 'sessions', label: 'Sessions', link: { to: '/dashboard/sessions' } }],
      },
    ]),
  ],
})

async function mountShell(entry: string, badges?: { dashboard?: number }): Promise<void> {
  const rootRoute = createRootRoute({
    component: () => <BasaltShell brand={{ name: 'Argo' }} nav={NAV} badges={badges} />,
  })
  const children = ['/', '/dashboard', '/dashboard/sessions'].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
  )
  const router = createRouter({
    routeTree: rootRoute.addChildren(children),
    history: createMemoryHistory({ initialEntries: [entry] }),
  })
  render(
    <MantineProvider>
      <RouterProvider router={router} />
    </MantineProvider>,
  )
  await waitFor(() => expect(router.state.status).toBe('idle'))
}

afterEach(cleanup)

describe('BasaltShell nav prop', () => {
  test('the deepest match is the one current page — its parent is not also aria-current', async () => {
    await mountShell('/dashboard/sessions')
    const current = document.querySelectorAll('a[aria-current="page"]')
    expect(current).toHaveLength(1)
    expect(current[0]?.textContent).toContain('Sessions')
  })

  test('the breadcrumb derives from the resolved nav: section / parent / page', async () => {
    await mountShell('/dashboard/sessions')
    const header = document.querySelector('header')!
    expect(header.textContent).toContain('Main')
    expect(header.textContent).toContain('Dashboard')
    expect(header.textContent).toContain('Sessions')
  })

  test('badges reach the sidebar row as a count', async () => {
    await mountShell('/', { dashboard: 4 })
    expect(screen.getAllByText('4').length).toBeGreaterThan(0)
  })

  test('a badge key outside the nav id union is a compile error', () => {
    // Compile-time only: the `@ts-expect-error` fails `tsc` if the key stops being rejected.
    const typo = (
      <BasaltShell
        brand={{ name: 'Argo' }}
        nav={NAV}
        // @ts-expect-error 'dashbord' is not a destination id
        badges={{ dashbord: 1 }}
      />
    )
    expect(typo).toBeDefined()
  })
})
