/**
 * Anchor identity: a navigation (or an inline `badges` literal, or a new `link` closure) must never
 * remount a nav link. A new anchor component per render is a new component TYPE to React, which
 * unmounts the `<a>` and loses keyboard focus on the link the user just activated.
 *
 * Ported from the 2.x shell test without the shell: a small harness renders every item through
 * `navAnchor` and `useActiveNav`, which is all the nav core owns.
 */
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
import { navAnchor } from './anchor'
import { useActiveNav } from './use-active-nav'
import { defineNav } from '../../../tests/support/router-nav'
import type { AnyNavConfig, AnyNavItem } from './types'

const item = (id: string, to: string, extra: Partial<AnyNavItem> = {}): AnyNavItem => ({
  id,
  label: id,
  link: { to },
  ...extra,
})

const NAV: AnyNavConfig = defineNav({
  sections: [
    {
      id: 'main',
      label: 'Main',
      items: [
        item('home', '/'),
        item('dashboard', '/dashboard', { children: [item('sessions', '/dashboard/sessions')] }),
        // a click-time `search` function: legal, and re-evaluated per click, never per render
        item('calendar', '/calendar', {
          link: { to: '/calendar', search: () => ({ date: 'today' }) },
        }),
      ],
    },
  ],
})

const flat = (items: ReadonlyArray<AnyNavItem>): AnyNavItem[] =>
  items.flatMap((i) => [i, ...(i.children ? flat(i.children) : [])])

function Harness({ nav, count, search }: { nav: AnyNavConfig; count: number; search?: boolean }) {
  const { activeId, ancestorIds } = useActiveNav(nav)
  return (
    <nav>
      {flat(nav.sections.flatMap((s) => s.items)).map((it) => {
        const Anchor = navAnchor(it)
        return (
          <Anchor
            key={it.id}
            data-testid={it.id}
            data-ancestor={ancestorIds.has(it.id) ? 'true' : undefined}
            aria-current={it.id === activeId ? 'page' : undefined}
          >
            {it.label}
            {it.id === 'dashboard' && count}
            {search ? '!' : ''}
          </Anchor>
        )
      })}
    </nav>
  )
}

async function mount(entry: string, initial: AnyNavConfig = NAV) {
  const ctl = { setCount: (_n: number) => {}, setNav: (_n: AnyNavConfig) => {} }
  function Root() {
    const [count, setCount] = useState(1)
    const [nav, setNav] = useState(initial)
    useEffect(() => {
      ctl.setCount = setCount
      ctl.setNav = setNav
    }, [])
    return <Harness nav={nav} count={count} />
  }
  const rootRoute = createRootRoute({ component: Root })
  const childRoutes = ['/', '/dashboard', '/dashboard/sessions', '/calendar'].map((path) =>
    createRoute({ getParentRoute: () => rootRoute, path, component: () => null }),
  )
  const router = createRouter({
    routeTree: rootRoute.addChildren(childRoutes),
    history: createMemoryHistory({ initialEntries: [entry] }),
  })
  render(<RouterProvider router={router} />)
  await waitFor(() => expect(router.state.status).toBe('idle'))
  return { router, ctl }
}

function linkTo(href: string): HTMLAnchorElement {
  const el = document.querySelector(`nav a[href="${href}"]`)
  if (!(el instanceof HTMLAnchorElement)) throw new Error(`no <a href="${href}">`)
  return el
}
const HREFS = ['/', '/dashboard', '/dashboard/sessions', '/calendar?date=today'] as const
const links = (): HTMLAnchorElement[] => HREFS.map(linkTo)

function expectSameLinks(before: HTMLAnchorElement[]) {
  const after = links()
  after.forEach((a, i) => {
    expect(a).toBe(before[i]!)
    expect(a.isConnected).toBe(true)
  })
}

const searchyLink = () => document.querySelector('[data-testid="searchy"]')

// assigned by the search-signal test: its `activeWhen` reads the live router
let live: Awaited<ReturnType<typeof mount>>['router'] | undefined

afterEach(cleanup)

describe('nav anchor identity', () => {
  test('navigating keeps every link mounted, focus included', async () => {
    const { router } = await mount('/dashboard/sessions')
    const before = links()
    const clicked = linkTo('/')
    clicked.focus()
    await act(() => router.navigate({ to: '/' }))
    await waitFor(() => expect(linkTo('/').getAttribute('aria-current')).toBe('page'))
    expectSameLinks(before)
    expect(document.activeElement).toBe(clicked)
  })

  test('an inline value change does not remount a link', async () => {
    const { ctl } = await mount('/')
    const before = links()
    act(() => ctl.setCount(2))
    await waitFor(() => expect(linkTo('/dashboard').textContent).toContain('2'))
    expectSameLinks(before)
  })

  test('a link with a click-time search function keeps its DOM node across re-renders and navigation', async () => {
    const { ctl, router } = await mount('/')
    const before = linkTo('/calendar?date=today')
    act(() => ctl.setCount(3))
    act(() => ctl.setNav({ ...NAV }))
    await act(() => router.navigate({ to: '/dashboard' }))
    await waitFor(() => expect(linkTo('/dashboard').getAttribute('aria-current')).toBe('page'))
    expect(linkTo('/calendar?date=today')).toBe(before)
    expect(before.isConnected).toBe(true)
  })

  test('one anchor component per item object, stable across calls', () => {
    const a = item('a', '/a')
    expect(navAnchor(a)).toBe(navAnchor(a))
    expect(navAnchor(item('a', '/a'))).not.toBe(navAnchor(a))
  })
})

describe('active state', () => {
  test('the router href is the change signal: a search-only navigation re-derives', async () => {
    // `activeWhen` only sees the pathname, so it closes over the live router to read the search:
    // the pathname never moves here, so only the href signal can make the hook re-derive.
    const activeWhen = item('searchy', '/calendar', {
      activeWhen: () =>
        live !== undefined && new URL(`http://x${live.state.location.href}`).searchParams.has('on'),
    })
    const nav: AnyNavConfig = defineNav({
      sections: [{ id: 's', label: 'S', items: [item('home', '/'), activeWhen] }],
    })
    const { router: r } = await mount('/dashboard', nav)
    live = r
    // the pathname stays '/dashboard' while only the search moves
    expect(searchyLink()?.getAttribute('aria-current')).toBeNull()
    await act(() => r.navigate({ to: '/dashboard', search: { on: 1 } as never }))
    await waitFor(() => expect(searchyLink()?.getAttribute('aria-current')).toBe('page'))
  })

  test('the resolver is the only authority on aria-current: one winner, ancestors are not current', async () => {
    await mount('/dashboard/sessions')
    expect(linkTo('/dashboard/sessions').getAttribute('aria-current')).toBe('page')
    expect(linkTo('/dashboard').getAttribute('aria-current')).toBeNull()
    expect(linkTo('/dashboard').getAttribute('data-ancestor')).toBe('true')
    expect(linkTo('/').getAttribute('aria-current')).toBeNull()
  })

  test('a prefix winner carries aria-current although the router link is not an exact match', async () => {
    const nav: AnyNavConfig = defineNav({
      sections: [{ id: 's', label: 'S', items: [item('dashboard', '/dashboard')] }],
    })
    await mount('/dashboard/sessions', nav)
    expect(linkTo('/dashboard').getAttribute('aria-current')).toBe('page')
  })
})
