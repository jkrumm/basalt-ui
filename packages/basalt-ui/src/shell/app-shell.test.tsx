/**
 * `AppShell` without a browser layout: the server markup, hydration, the route announcer, the
 * document title and the print scheme. Geometry is `tests/layout/shell-frame.layout.test.ts`.
 */
import { act, cleanup, render, waitFor } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { hydrateRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { PageBar } from '../page/page-bar'
import { Page } from '../page/page'
import { navFor } from '../router/nav/registry'
import { AppShell } from './app-shell'
import type { AppShellProps } from './contract'

const NAV = {
  sections: [
    {
      id: 'main',
      label: 'Main',
      items: [
        { id: 'home', label: 'Overview', link: { to: '/' }, mobile: 'tab' },
        { id: 'runs', label: 'Runs', link: { to: '/runs' }, mobile: 'tab' },
      ],
    },
  ],
} satisfies AppShellProps['nav']

function makeRouter(entry = '/') {
  const root = createRootRoute({
    component: () => (
      <AppShell nav={NAV} brand={{ name: 'Basalt' }}>
        <Outlet />
      </AppShell>
    ),
  })
  const home = createRoute({
    getParentRoute: () => root,
    path: '/',
    component: () => <Page>Home</Page>,
  })
  const runs = createRoute({
    getParentRoute: () => root,
    path: '/runs',
    component: () => (
      <Page>
        <PageBar title="Run list" />
      </Page>
    ),
  })
  return createRouter({
    routeTree: root.addChildren([home, runs]),
    history: createMemoryHistory({ initialEntries: [entry] }),
  })
}

afterEach(() => {
  cleanup()
  document.title = ''
})

describe('AppShell on the server', () => {
  test('renders the rail and the tab bar stubs, the skip link and one main', async () => {
    const router = makeRouter()
    await router.load()
    const html = renderToString(<RouterProvider router={router} />)
    expect(html).toContain('data-slot="shell-rail"')
    expect(html).toContain('data-slot="shell-tab-bar"')
    expect(html).toContain('data-slot="shell-skip"')
    expect(html.match(/<main/g)).toHaveLength(1)
    expect(html).toContain('data-rail="auto"')
    // The breadcrumb is the nav-derived label: nothing has claimed the title yet.
    expect(html).toContain('data-slot="page-breadcrumb-leaf">Overview<')
  })

  test('registers the declared nav against its router', async () => {
    const router = makeRouter()
    await router.load()
    renderToString(<RouterProvider router={router} />)
    expect(navFor(router)).toBe(NAV as never)
  })

  test('hydrates the server markup without a mismatch', async () => {
    const router = makeRouter()
    await router.load()
    const html = renderToString(<RouterProvider router={router} />)
    const container = document.createElement('div')
    container.innerHTML = html
    document.body.append(container)
    const errors = spyOn(console, 'error').mockImplementation(() => {})
    const warnings = spyOn(console, 'warn').mockImplementation(() => {})
    const recoverable: unknown[] = []
    const clientRouter = makeRouter()
    await clientRouter.load()
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, <RouterProvider router={clientRouter} />, {
        onRecoverableError: (error) => recoverable.push(error),
      })
    })
    expect(recoverable).toEqual([])
    expect(errors.mock.calls.map(String)).toEqual([])
    expect(warnings.mock.calls.map(String)).toEqual([])
    errors.mockRestore()
    warnings.mockRestore()
    act(() => root?.unmount())
    container.remove()
  })
})

describe('AppShell in the client', () => {
  test('composes the document title from the page and the brand', async () => {
    const router = makeRouter('/runs')
    render(<RouterProvider router={router} />)
    await waitFor(() => expect(document.title).toBe('Run list · Basalt'))
  })

  test('falls back to the active nav label when the page claims no title', async () => {
    render(<RouterProvider router={makeRouter('/')} />)
    await waitFor(() => expect(document.title).toBe('Overview · Basalt'))
  })

  test('announces the new title after a pathname change, not on the first render', async () => {
    const router = makeRouter('/')
    render(<RouterProvider router={router} />)
    await waitFor(() => expect(document.title).toBe('Overview · Basalt'))
    const announcer = (): string =>
      document.querySelector('[data-slot="shell-announcer"]')?.textContent ?? 'missing'
    expect(announcer()).toBe('')
    await act(() => router.navigate({ to: '/runs' }))
    await waitFor(() => expect(announcer()).toBe('Run list · Basalt'))
  })

  test('a search-only change announces nothing', async () => {
    const router = makeRouter('/')
    render(<RouterProvider router={router} />)
    await waitFor(() => expect(document.title).toBe('Overview · Basalt'))
    await act(() => router.navigate({ to: '/', search: { q: 'x' } as never }))
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    expect(document.querySelector('[data-slot="shell-announcer"]')?.textContent).toBe('')
  })

  test('prints in the light scheme and puts the scheme back', async () => {
    document.documentElement.setAttribute('data-theme', 'dark')
    render(<RouterProvider router={makeRouter('/')} />)
    await waitFor(() => expect(document.title).toBe('Overview · Basalt'))
    window.dispatchEvent(new Event('beforeprint'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('light')
    window.dispatchEvent(new Event('afterprint'))
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    document.documentElement.removeAttribute('data-theme')
  })

  test('the frame carries the data-slot of every part it renders', async () => {
    render(<RouterProvider router={makeRouter('/')} />)
    await waitFor(() => expect(document.title).toBe('Overview · Basalt'))
    for (const name of [
      'shell',
      'shell-skip',
      'shell-header',
      'shell-lead',
      'shell-breadcrumb',
      'shell-main',
      'shell-aside',
      'shell-rail',
      'shell-tab-bar',
    ]) {
      expect(document.querySelector(`[data-slot="${name}"]`), name).not.toBeNull()
    }
    expect(document.querySelector('main')?.getAttribute('tabindex')).toBe('-1')
  })
})
