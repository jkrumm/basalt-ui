/**
 * Anchor identity: a navigation (or an inline `badges` literal) must never remount a nav link.
 * A new `Anchor` function per resolve is a new component TYPE to React, which unmounts the `<a>`
 * and loses keyboard focus on the link the user just activated.
 */
import { MantineProvider } from '@mantine/core'
import { act, cleanup, render, waitFor } from '@testing-library/react'
import { useEffect, useState } from 'react'
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
  mobile: { tabs: ['home', 'dashboard'] },
})

const badgeControl = { set: (_n: number) => {} }
let shellExtra: { isActive?: (item: { id: string }) => boolean } = {}

function Root() {
  const [count, setCount] = useState(1)
  useEffect(() => {
    badgeControl.set = setCount
  }, [])
  // An inline literal, rebuilt on every render of this component.
  return (
    <BasaltShell brand={{ name: 'Argo' }} nav={NAV} badges={{ dashboard: count }} {...shellExtra} />
  )
}

async function mountShell(entry: string, extra: typeof shellExtra = {}) {
  shellExtra = extra
  const rootRoute = createRootRoute({ component: Root })
  const childRoutes = ['/', '/dashboard', '/dashboard/sessions'].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
  )
  const router = createRouter({
    routeTree: rootRoute.addChildren(childRoutes),
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

// The rows that stay structurally in place across a route change. (The expandable Dashboard row
// legitimately swaps its collapsed/expanded branch, so it is not in this set.)
const STABLE = [
  ['/', 'sidebar'],
  ['/', 'bar'],
  ['/dashboard', 'bar'],
] as const
const stableLinks = (): HTMLAnchorElement[] => STABLE.map(([href, within]) => linkTo(href, within))
function linkTo(href: string, within: 'sidebar' | 'bar'): HTMLAnchorElement {
  const root = within === 'sidebar' ? '.mantine-AppShell-navbar' : 'nav[aria-label="Primary"]'
  const el = document.querySelector(`${root} a[href="${href}"]`)
  if (!(el instanceof HTMLAnchorElement)) throw new Error(`no <a href="${href}"> in the ${within}`)
  return el
}

afterEach(cleanup)

describe('nav anchor identity', () => {
  test('navigating keeps every nav link (sidebar, mobile bar) mounted, focus included', async () => {
    const router = await mountShell('/dashboard/sessions')
    const before = stableLinks()
    expect(linkTo('/dashboard', 'sidebar')).toBeDefined()
    expect(linkTo('/', 'bar')).toBeDefined()

    const clicked = linkTo('/', 'sidebar')
    clicked.focus()
    await act(() => router.navigate({ to: '/' }))
    await waitFor(() => expect(linkTo('/', 'sidebar').getAttribute('aria-current')).toBe('page'))

    expect(stableLinks().every((a, i) => a === before[i] && a.isConnected)).toBe(true)
    expect(linkTo('/', 'sidebar')).toBe(clicked)
    expect(document.activeElement).toBe(clicked)
  })

  test('an inline badges literal with a new value does not remount a link', async () => {
    await mountShell('/')
    const before = stableLinks()
    act(() => badgeControl.set(2))
    await waitFor(() => expect(linkTo('/dashboard', 'sidebar').textContent).toContain('2'))
    expect(stableLinks().every((a, i) => a === before[i] && a.isConnected)).toBe(true)
  })

  test('under an isActive override the links also survive a navigation', async () => {
    const router = await mountShell('/', { isActive: (item) => item.id === 'home' })
    const before = stableLinks()
    expect(before).toHaveLength(STABLE.length)
    await act(() => router.navigate({ to: '/dashboard' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))
    expect(stableLinks().every((a, i) => a === before[i] && a.isConnected)).toBe(true)
  })
})
