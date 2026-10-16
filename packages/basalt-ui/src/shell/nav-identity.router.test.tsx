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

type Isolated = (item: { id: string }) => boolean

async function mountShell(entry: string, isActive?: Isolated) {
  const badges = { set: (_n: number) => {} }
  function Root() {
    const [count, setCount] = useState(1)
    useEffect(() => {
      badges.set = setCount
    }, [])
    // An inline literal, rebuilt on every render of this component.
    return (
      <BasaltShell
        brand={{ name: 'Argo' }}
        nav={NAV}
        badges={{ dashboard: count }}
        {...(isActive && { isActive })}
      />
    )
  }
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
  return { router, setBadge: (n: number) => badges.set(n) }
}

type Place = 'sidebar' | 'bar' | 'header'
function linkTo(href: string, within: Place): HTMLAnchorElement {
  const root = {
    sidebar: '.mantine-AppShell-navbar',
    bar: 'nav[aria-label="Primary"]',
    header: 'header',
  }[within]
  const el = document.querySelector(`${root} a[href="${href}"]`)
  if (!(el instanceof HTMLAnchorElement)) throw new Error(`no <a href="${href}"> in the ${within}`)
  return el
}

// The rows that stay structurally in place across a route change. (The expandable Dashboard row
// legitimately swaps its collapsed/expanded branch, so it is not in this set.)
const STABLE: ReadonlyArray<readonly [string, Place]> = [
  ['/', 'sidebar'],
  ['/', 'bar'],
  ['/dashboard', 'bar'],
]
const linksOf = (set: ReadonlyArray<readonly [string, Place]>): HTMLAnchorElement[] =>
  set.map(([href, within]) => linkTo(href, within))

/** Every link in `set` is still the very node captured in `before`, and still attached. */
function expectSameLinks(
  set: ReadonlyArray<readonly [string, Place]>,
  before: HTMLAnchorElement[],
) {
  const after = linksOf(set)
  expect(after).toHaveLength(before.length)
  after.forEach((a, i) => {
    expect(a).toBe(before[i]!)
    expect(a.isConnected).toBe(true)
  })
}

afterEach(cleanup)

describe('nav anchor identity', () => {
  test('navigating keeps every nav link (sidebar, mobile bar) mounted, focus included', async () => {
    const { router } = await mountShell('/dashboard/sessions')
    const before = linksOf(STABLE)
    const clicked = linkTo('/', 'sidebar')
    clicked.focus()
    await act(() => router.navigate({ to: '/' }))
    await waitFor(() => expect(linkTo('/', 'sidebar').getAttribute('aria-current')).toBe('page'))

    expectSameLinks(STABLE, before)
    expect(document.activeElement).toBe(clicked)
  })

  test('the breadcrumb parent link survives a navigation within its page', async () => {
    const { router } = await mountShell('/dashboard/sessions')
    const withCrumb = [...STABLE, ['/dashboard', 'header'] as const]
    const before = linksOf(withCrumb)
    await act(() => router.navigate({ to: '/dashboard/sessions', search: { page: 2 } as never }))
    await waitFor(() => expect(router.state.location.search).toEqual({ page: 2 }))
    expectSameLinks(withCrumb, before)
  })

  test('an inline badges literal with a new value does not remount a link', async () => {
    const { setBadge } = await mountShell('/')
    const before = linksOf(STABLE)
    act(() => setBadge(2))
    await waitFor(() => expect(linkTo('/dashboard', 'sidebar').textContent).toContain('2'))
    expectSameLinks(STABLE, before)
  })

  test('under an isActive override the links also survive a navigation', async () => {
    const { router } = await mountShell('/', (item) => item.id === 'home')
    const before = linksOf(STABLE)
    await act(() => router.navigate({ to: '/dashboard' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/dashboard'))
    expectSameLinks(STABLE, before)
  })
})
