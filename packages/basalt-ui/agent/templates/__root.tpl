/**
 * TanStack Router root route. `BasaltRouterContext` types the context `createBasaltRouter` fills
 * (the QueryClient); extend it for your own context and pass the value to
 * `createBasaltRouter({ routeTree, context })`.
 *
 * Scaffold written by `basalt-ui init`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import { Outlet, createRootRouteWithContext, linkOptions } from '@tanstack/react-router'
import { BasaltShell, defineNav, navGroup } from 'basalt-ui'
import type { BasaltRouterContext } from 'basalt-ui'

// Move this to a leaf module (`src/lib/nav.tsx`) once it grows — see basalt-state.md.
const NAV = defineNav({
  groups: [
    navGroup({ id: 'main', label: 'Main' }, [
      { id: 'home', label: 'Home', link: linkOptions({ to: '/' }) },
    ]),
  ],
})

export const Route = createRootRouteWithContext<BasaltRouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <BasaltShell
      brand={{ name: '{{APP_NAME}}' }}
      nav={NAV}
    >
      <Outlet />
    </BasaltShell>
  )
}
