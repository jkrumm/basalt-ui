/**
 * The entry: builds the router from `routerDefaults` and mounts it. `routerDefaults` sets preloading,
 * the 300/300 pending timing, structural sharing, scroll restoration and the route transition; the
 * pending, error and not-found components are yours (`components/route-*.tsx`), and a router
 * without a pending component never shows pending at all (`doctor` check 12 fails on a missing one).
 * `Register` below is what types `defineNav`, `navTarget` and every `<Link to>`.
 *
 * Scaffold written by `basalt-ui init` to `src/main.tsx`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import './index.css'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BasaltProvider } from 'basalt-ui/core/provider'
import { makeQueryClient } from 'basalt-ui/data'
import { routerDefaults } from 'basalt-ui/router'
import { RouteError } from './components/route-error'
import { RouteMissing } from './components/route-missing'
import { RoutePending } from './components/route-pending'
import { routeTree } from './routeTree.gen'

const queryClient = makeQueryClient()
// `link` opens a `navTarget` for any prop typed `string | NavTarget` (a `LinkComponent`): pass it where one is taken.
const defaults = routerDefaults({ router: (): object => router })
export const link = defaults.link

export const router = createRouter({
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

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById('root')!).render(
  <BasaltProvider>
    <RouterProvider router={router} />
  </BasaltProvider>,
)
