/**
 * Mantine-free memory-history router harness for the invariant tests: no dev server, no browser.
 * `probe` runs inside a component under the root route, so handle hooks (`use()`, `useValues()`)
 * work. Navigation is observed through `router.state.location`.
 */
import { createElement } from 'react'
import { act, render } from '@testing-library/react'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import type { ControlsStore } from './api'

type TestRouter = {
  load(): Promise<void>
  navigate(opts: object): Promise<void>
  state: { location: { href: string; search: Record<string, unknown> } }
}

type Opts = {
  /** The global store on the root route. */
  root: ControlsStore
  /** Page stores by path; each path becomes a child route. */
  pages?: Record<string, ControlsStore>
  url: string
  probe?: () => void
}

export async function mountRouter({
  root,
  pages = { '/a': undefined as never },
  url,
  probe,
}: Opts) {
  const rootRoute = createRootRoute({
    validateSearch: root.validateSearch as never,
    search: { middlewares: root.middlewares as never },
    component: () => {
      probe?.()
      return createElement(Outlet)
    },
  })
  const children = Object.entries(pages).map(([path, store]) =>
    createRoute({
      getParentRoute: () => rootRoute as never,
      path,
      ...(store
        ? {
            validateSearch: store.validateSearch as never,
            search: { middlewares: store.middlewares as never },
          }
        : {}),
    }),
  )
  // The harness drives routes whose types are erased on purpose; the typed surface is ctl-2's.
  const create = createRouter as unknown as (o: object) => TestRouter
  const router = create({
    routeTree: rootRoute.addChildren(children as never),
    history: createMemoryHistory({ initialEntries: [url] }),
  })
  await router.load()
  render(
    createElement(RouterProvider as unknown as (p: { router: TestRouter }) => null, { router }),
  )
  const go = (to: string, search?: Record<string, unknown>) =>
    act(() => router.navigate({ to, search } as never))
  return { router, go, href: () => router.state.location.href }
}
