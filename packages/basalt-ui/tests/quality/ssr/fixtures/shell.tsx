/**
 * Fixture `shell` (the TanStack Start host, `init --profile app --start`): what the Start root
 * route's `component` renders, `BasaltProvider` around the shell around an outlet, under a router
 * with memory history (a server has no URL bar). The harness renders it in a process with no DOM and
 * no storage, so a `window`, `document` or `localStorage` read during render throws; it then hydrates
 * the same page. `ready` is the router's first load, which Start also awaits before it renders.
 */
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'

import { BasaltProvider } from '../../../../src/core/provider'
import { routerDefaults } from '../../../../src/router/defaults'
import { AppShell } from '../../../../src/shell/app-shell'
import { defineNav } from '../../../../tests/support/router-nav'

const NAV = defineNav({
  sections: [
    {
      id: 'main',
      label: 'Main',
      items: [{ id: 'home', label: 'Home', link: { to: '/' }, mobile: 'tab' }],
    },
  ],
})

const defaults = routerDefaults()

const rootRoute = createRootRoute({
  component: () => (
    <BasaltProvider link={defaults.link}>
      <AppShell nav={NAV} brand={{ name: 'Basalt' }}>
        <Outlet />
      </AppShell>
    </BasaltProvider>
  ),
})
const home = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <p data-slot="fixture">Home</p>,
})

const router = createRouter({
  routeTree: rootRoute.addChildren([home]),
  history: createMemoryHistory({ initialEntries: ['/'] }),
  ...defaults.options,
  // Restoration's inline script is a `ScriptOnce`: in a browser it removes itself before React hydrates,
  // which this harness (it does not run the markup's scripts) cannot show, so it would read as a mismatch.
  scrollRestoration: false,
})
defaults.bind(router)
// What Start's client sets when it hydrates a server-rendered router: without it the browser renders
// the pending state (a Suspense fallback) where the server rendered the page.
if (typeof document !== 'undefined') router.ssr = { manifest: undefined }

export const ready = router.load()

export function Page() {
  return <RouterProvider router={router} />
}
