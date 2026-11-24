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
import { createQueryClient } from 'basalt-ui/data'
import { BasaltProvider, routerDefaults } from 'basalt-ui/router'
import { LucideProvider } from 'lucide-react'
import { RouteError } from './components/route-error'
import { RouteMissing } from './components/route-missing'
import { RoutePending } from './components/route-pending'
import { routeTree } from './routeTree.gen'

const queryClient = createQueryClient()
const defaults = routerDefaults()

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
// The route transition reads its direction from the nav `AppShell` registers on this router.
defaults.bind(router)

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

// `link` makes every link prop (`StatCard href`, `CardAction`, `col.entity`) navigate through the router: no document load.
// Push updates: `live={bindInvalidation(queryClient, channel, o)}` here (docs/bind-invalidation.md).
// The icon defaults the shipped basalt rule names (16 px, 1.5 px stroke): one provider per React root.
createRoot(document.getElementById('root')!).render(
  <BasaltProvider link={defaults.link}>
    <LucideProvider size={16} strokeWidth={1.5} absoluteStrokeWidth>
      <RouterProvider router={router} />
    </LucideProvider>
  </BasaltProvider>,
)
