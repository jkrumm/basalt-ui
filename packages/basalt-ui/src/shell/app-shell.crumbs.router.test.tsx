/**
 * The crumb trail under a real router at encoded URLs: a nav item on a param route and a route that
 * names itself through `staticData.title` stay ancestors when a segment carries an encoded character,
 * and the route ancestor's link keeps that character in its path.
 */
import { cleanup, render, waitFor } from '@testing-library/react'
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { afterEach, describe, expect, test } from 'bun:test'
import { BasaltProvider } from '../core/provider'
import { routerDefaults } from '../router/defaults'
import { Page } from '../page/page'
import { PageBar } from '../page/page-bar'
import { AppShell } from './app-shell'
import { defineNav } from '../../tests/support/router-nav'

afterEach(cleanup)

const NAV = defineNav({
  sections: [
    {
      id: 'runs',
      label: 'Runs',
      items: [{ id: 'run', label: 'Run', link: { to: '/r/$id' }, mobile: 'tab' }],
    },
  ],
})

function mount(entry: string): void {
  const rootRoute = createRootRoute({
    component: () => (
      <AppShell nav={NAV} brand={{ name: 'Basalt' }}>
        <Outlet />
      </AppShell>
    ),
  })
  const run = createRoute({ getParentRoute: () => rootRoute, path: '/r/$id', component: Outlet })
  const logs = createRoute({
    getParentRoute: () => run,
    path: '/logs',
    component: () => (
      <Page>
        <PageBar title="Logs" />
      </Page>
    ),
  })
  const note = createRoute({
    getParentRoute: () => rootRoute,
    path: '/n/$slug',
    staticData: { title: 'Note' },
    component: Outlet,
  })
  const edit = createRoute({
    getParentRoute: () => note,
    path: '/edit',
    component: () => (
      <Page>
        <PageBar title="Edit" />
      </Page>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([run.addChildren([logs]), note.addChildren([edit])]),
    history: createMemoryHistory({ initialEntries: [entry] }),
  })
  render(
    <BasaltProvider link={routerDefaults().link}>
      <RouterProvider router={router} />
    </BasaltProvider>,
  )
}

/** The trail as read, separators left out: each part's text and, for a link, its path. */
const trail = (): { text: string | null; href: string | null }[] =>
  [...(document.querySelector('[data-slot="shell-breadcrumb"]')?.children ?? [])]
    .filter((el) => el.getAttribute('data-slot') !== 'page-breadcrumb-separator')
    .map((el) => ({ text: el.textContent, href: el.getAttribute('href') }))

const leaf = (): string | undefined =>
  document.querySelector('[data-slot="page-breadcrumb-leaf"]')?.textContent ?? undefined

describe('the crumb trail at an encoded URL', () => {
  test('a nav item on a param route stays the ancestor of a deeper page', async () => {
    mount('/r/run%207/logs')
    await waitFor(() => expect(leaf()).toBe('Logs'))
    const parts = trail()
    expect(parts.map((p) => p.text)).toEqual(['Runs', 'Run', 'Logs'])
    expect(parts[1]?.href).toBe('/r/run%207')
  })

  test("a route's staticData title is a link whose path keeps the encoded character", async () => {
    mount('/n/a%3Fb/edit')
    await waitFor(() => expect(leaf()).toBe('Edit'))
    const parts = trail()
    expect(parts.map((p) => p.text)).toEqual(['Note', 'Edit'])
    expect(parts[0]?.href).toBe('/n/a%3Fb')
  })
})
