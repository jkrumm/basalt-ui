/**
 * `BasaltShell nav={NAV}` under a REAL TanStack memory router: the prop resolves active state
 * (one winner), feeds the breadcrumb, the mobile bar and typed badges, with no `useNav` spread in
 * the caller. `use-nav.test.tsx` owns the resolver's exclusivity matrix; this pins that the SHELL
 * wires it.
 */
import { MantineProvider } from '@mantine/core'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import type { AnyNavItem } from '../router-tanstack/nav'
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
  mobile: { tabs: ['home', 'dashboard'] },
})

type ShellProps = {
  badges?: Partial<Record<'home' | 'dashboard' | 'sessions', number | ReactNode>>
  isActive?: (item: AnyNavItem) => boolean
}

async function mountShell(entry: string, props: ShellProps = {}) {
  const rootRoute = createRootRoute({
    component: () => <BasaltShell brand={{ name: 'Argo' }} nav={NAV} {...props} />,
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
  return router
}

const BAR = 'nav[aria-label="Primary"]'
/** The sidebar's current-page anchors — the mobile bar is asserted separately. */
const currentPages = (): Element[] =>
  [...document.querySelectorAll('a[aria-current="page"]')].filter((a) => !a.closest(BAR))
const header = (): string => document.querySelector('header')!.textContent ?? ''

afterEach(cleanup)

describe('BasaltShell nav prop', () => {
  test('the deepest match is the one current page — its parent is not also aria-current', async () => {
    await mountShell('/dashboard/sessions')
    expect(currentPages()).toHaveLength(1)
    expect(currentPages()[0]?.textContent).toContain('Sessions')
  })

  test('navigating after mount moves the single winner and the breadcrumb', async () => {
    const router = await mountShell('/dashboard/sessions')
    expect(header()).toContain('Sessions')

    await act(() => router.navigate({ to: '/' }))
    await waitFor(() => expect(currentPages()[0]?.textContent).toContain('Home'))
    expect(currentPages()).toHaveLength(1)
    expect(header()).toContain('Home')
    expect(header()).not.toContain('Sessions')
  })

  test('the breadcrumb derives from the resolved nav: section / parent / page', async () => {
    await mountShell('/dashboard/sessions')
    expect(header()).toContain('Main')
    expect(header()).toContain('Dashboard')
    expect(header()).toContain('Sessions')
  })

  test('a number badge reaches the sidebar row as a count', async () => {
    await mountShell('/', { badges: { dashboard: 4 } })
    expect(screen.getAllByText('4').length).toBeGreaterThan(0)
  })

  test('a ReactNode badge renders verbatim on the row', async () => {
    await mountShell('/', { badges: { dashboard: <span data-testid="beta">beta</span> } })
    expect(screen.getAllByTestId('beta').length).toBeGreaterThan(0)
  })

  test('the mobile bar derives from defineNav mobile.tabs and marks the active slot', async () => {
    await mountShell('/')
    const bar = document.querySelector(BAR)!
    const labels = [...bar.querySelectorAll('[aria-label]')].map((e) =>
      e.getAttribute('aria-label'),
    )
    expect(labels).toEqual(['Home', 'Dashboard', 'More'])
    expect(bar.querySelector('[aria-label="Home"]')?.getAttribute('aria-current')).toBe('page')
    expect(bar.querySelector('[aria-label="Dashboard"]')?.getAttribute('aria-current')).toBeNull()
  })

  test('isActive overrides the router match: the override picks the row and the breadcrumb', async () => {
    // At `/` the router would light Home; the override names Dashboard instead. (A router `<Link>`
    // also stamps its own `aria-current` on the anchor it exactly matches, so Home may carry one
    // too — the shell's winner is what the breadcrumb follows.)
    await mountShell('/', { isActive: (item) => item.id === 'dashboard' })
    expect(currentPages().some((a) => a.textContent?.includes('Dashboard'))).toBe(true)
    expect(header()).toContain('Dashboard')
    expect(header()).not.toContain('Home')
  })

  test('a missing nav or brand throws the written required-prop message', () => {
    const error = spyOn(console, 'error').mockImplementation(() => {})
    const bare = (props: object) => () =>
      render(
        <MantineProvider>
          {/* @ts-expect-error deliberately incomplete props */}
          <BasaltShell {...props} />
        </MantineProvider>,
      )
    expect(bare({ brand: { name: 'Argo' } })).toThrow(/nav/)
    expect(bare({ nav: NAV })).toThrow(/brand/)
    error.mockRestore()
  })

  test('sections, mobileNav and a mistyped badge id are compile errors', () => {
    const typo = (
      <>
        {/* @ts-expect-error 'sections' left the public props: pass nav */}
        <BasaltShell brand={{ name: 'Argo' }} nav={NAV} sections={[]} />
        {/* @ts-expect-error 'mobileNav' left the public props: tuning rides defineNav mobile */}
        <BasaltShell brand={{ name: 'Argo' }} nav={NAV} mobileNav={{}} />
        {/* @ts-expect-error 'dashbord' is not a destination id */}
        <BasaltShell brand={{ name: 'Argo' }} nav={NAV} badges={{ dashbord: 1 }} />
      </>
    )
    expect(typo).toBeDefined()
  })
})
