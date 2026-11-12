/**
 * The `overview` fixture (docs/v3/issues/g1/v3-playground-overview.json): the playground overview
 * route's own component, mounted in a memory router whose root route does not mount the global store
 * (the bound card shows the global's fallback). The URL
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
import { Route as OverviewFileRoute } from '../../../../apps/playground/src/routes/overview'

const Overview = OverviewFileRoute.options.component

const root = createRootRoute({
  component: () => <Outlet />,
})
const page = createRoute({
  getParentRoute: () => root,
  path: '/overview',
  validateSearch: OverviewFileRoute.options.validateSearch,
  search: OverviewFileRoute.options.search,
  component: () => (
    <main lang="en" className="p-4 text-foreground">
      <Overview />
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
