/**
 * TanStack Start router entry: Start calls `getRouter()` once per request on the server and once in
 * the browser, so the `QueryClient` is built inside it (a module-level client would carry one
 * visitor's data to the next). `routerDefaults` sets preloading, the 300/300 pending timing,
 * structural sharing, scroll restoration and the route transition; the pending, error and not-found
 * components are yours (`components/route-*.tsx`), and `doctor` check 12 fails on a missing one.
 * `Register` below is what types `defineNav`, `navTarget` and every `<Link to>`.
 *
 * Scaffold written by `basalt-ui init --start` to `src/router.tsx`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { createQueryClient } from 'basalt-ui/data'
import { routerDefaults } from 'basalt-ui/router'
import { RouteError } from './components/route-error'
import { RouteMissing } from './components/route-missing'
import { RoutePending } from './components/route-pending'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = createQueryClient()
  const defaults = routerDefaults()
  const router = createRouter({
    routeTree,
    context: { queryClient },
    ...defaults.options,
    Wrap: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
    defaultPendingComponent: RoutePending,
    defaultErrorComponent: RouteError,
    defaultNotFoundComponent: RouteMissing,
  })
  // The route transition reads its direction from the nav `AppShell` registers on this router.
  defaults.bind(router)
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
