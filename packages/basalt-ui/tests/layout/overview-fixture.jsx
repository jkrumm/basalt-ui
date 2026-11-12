/**
 * The `overview` fixture (docs/v3/issues/g1/v3-playground-overview.json): the playground overview
 * route's own component, mounted in a memory router whose root route runs the global store. The URL
 * overrides the `errors` card's range, so the page shows one bound and one overridden card. The
 * harness is told to "mount" it by a no-op `window.basaltMountFixture`.
 */
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { createRoot } from 'react-dom/client'
import { OverviewRoute, globals, overview } from '../../../../apps/playground/src/routes/overview'

const root = createRootRoute({
  validateSearch: globals.validateSearch,
  search: { middlewares: globals.middlewares },
  component: () => <Outlet />,
})
const page = createRoute({
  getParentRoute: () => root,
  path: '/overview',
  validateSearch: overview.validateSearch,
  search: { middlewares: overview.middlewares },
  component: () => (
    <main lang="en" className="p-4 text-foreground">
      <OverviewRoute />
    </main>
  ),
})
const router = createRouter({
  routeTree: root.addChildren([page]),
  history: createMemoryHistory({ initialEntries: ['/overview?w.errors.range=30d'] }),
})

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
window.basaltMountFixture = async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<RouterProvider router={router} />)
