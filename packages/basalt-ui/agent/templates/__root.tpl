/**
 * TanStack Router root route. `BasaltRouterContext` types the context `createBasaltRouter` fills
 * (the QueryClient); extend it for your own context and pass the value to
 * `createBasaltRouter({ routeTree, context })`.
 *
 * Scaffold written by `basalt-ui init`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { BasaltShell } from 'basalt-ui'
import type { BasaltRouterContext } from 'basalt-ui'
import { NAV } from '../lib/nav'

export const Route = createRootRouteWithContext<BasaltRouterContext>()({
  component: RootComponent,
})

// Exported: react/only-export-components flags a non-exported component in a file that exports `Route`.
export function RootComponent() {
  return (
    <BasaltShell brand={{ name: '{{APP_NAME}}' }} nav={NAV}>
      <Outlet />
    </BasaltShell>
  )
}
