/**
 * The `kit-projects` fixture (docs/v3/issues/bench/bench-table-reading.json): the playground's
 * `/kit/projects` route component, mounted in a memory router at the document's own query
 * (`?rows=flat&height=comfortable`), so a test opens each view state by its URL.
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
import { Route as ProjectsFileRoute } from '../../../../apps/playground/src/routes/kit/projects'

const Projects = ProjectsFileRoute.options.component

const root = createRootRoute({ component: () => <Outlet /> })
const page = createRoute({
  getParentRoute: () => root,
  path: '/kit/projects',
  validateSearch: ProjectsFileRoute.options.validateSearch,
  search: ProjectsFileRoute.options.search,
  component: () => (
    <main lang="en" className="p-4 text-foreground">
      <Projects />
    </main>
  ),
})
const router = createRouter({
  routeTree: root.addChildren([page]),
  history: createMemoryHistory({ initialEntries: [`/kit/projects${window.location.search}`] }),
})

const container = document.getElementById('root')
if (!container) throw new Error('fixture host is missing #root')
window.basaltMountFixture = async () => {}
document.body.classList.add('bg-background')
createRoot(container).render(<RouterProvider router={router} />)
