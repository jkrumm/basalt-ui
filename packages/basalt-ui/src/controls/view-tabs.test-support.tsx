/**
 * A memory-history router around one page, for the suites that drive a real `defineControls` handle
 * (`view-tabs`, `view-tabs.inner-nav`, `globals`). Test-only; never exported from the package.
 */
import { createElement } from 'react'
import type { ReactElement } from 'react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'

/** What a store hands a route: its validator and its middlewares. */
export type Mountable = { validateSearch: unknown; middlewares: unknown }

export type TestRouter = {
  load(): Promise<void>
  navigate(o: object): Promise<void>
  buildLocation(o: object): { href: string }
  state: { location: { href: string; search: Record<string, unknown> } }
}

export type MountOptions = {
  url: string
  /** The root route's store: the globals. */
  globals?: Mountable
  /** The page route's store. */
  store?: Mountable
  /** The page, drawn at `/p`. */
  page: () => ReactElement
  /** The root layout around `<Outlet />`; the default is the outlet alone. */
  layout?: (outlet: ReactElement) => ReactElement
}

export type Mounted = {
  router: TestRouter
  history: ReturnType<typeof createMemoryHistory>
  /** The element to render (or `renderToString`). */
  app: ReactElement
}

/** Builds and loads the router; render `app` yourself, so a suite can pick client or server. */
export async function mountApp(o: MountOptions): Promise<Mounted> {
  const layout = o.layout ?? ((outlet: ReactElement) => outlet)
  const root = createRootRoute({
    ...(o.globals !== undefined && {
      validateSearch: o.globals.validateSearch as never,
      search: { middlewares: o.globals.middlewares as never },
    }),
    component: () => layout(createElement(Outlet)),
  })
  const page = createRoute({
    getParentRoute: () => root as never,
    path: '/p',
    ...(o.store !== undefined && {
      validateSearch: o.store.validateSearch as never,
      search: { middlewares: o.store.middlewares as never },
    }),
    component: o.page,
  })
  const history = createMemoryHistory({ initialEntries: [o.url] })
  const create = createRouter as unknown as (o: object) => TestRouter
  const router = create({ routeTree: root.addChildren([page] as never), history })
  await router.load()
  const app = createElement(RouterProvider as unknown as (p: { router: TestRouter }) => null, {
    router,
  })
  return { router, history, app }
}
