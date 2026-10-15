/**
 * Test helper — a real `createBasaltRouter` over a one-component root route plus an `/other` leaf,
 * so provider tests mount the actual tree (QueryClient in context, RouterProvider, overlays).
 */
import { Outlet, createRootRoute, createRoute } from '@tanstack/react-router'
import type { AnyRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { createBasaltRouter } from './create-router'
import type { BasaltRouterContext } from './create-router'

/** The router's QueryClient — a plain root route declares no context type, so read it untyped. */
export const queryClientOf = (router: AnyRouter): BasaltRouterContext['queryClient'] =>
  (router.options.context as BasaltRouterContext).queryClient

export function testRouter(text = 'content', wrap?: (children: ReactNode) => ReactNode) {
  const body = (
    <>
      <div>{text}</div>
      <Outlet />
    </>
  )
  const root = createRootRoute({ component: () => (wrap ? wrap(body) : body) })
  const other = createRoute({ getParentRoute: () => root, path: '/other', component: () => null })
  return createBasaltRouter({ routeTree: root.addChildren([other]) })
}
