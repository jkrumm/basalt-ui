/**
 * TanStack Router root route — wires QueryClient into the router context so
 * loader functions and components can call `Route.useRouteContext()`.
 *
 * Scaffold written by `basalt init`. This file is yours — `basalt sync` will not overwrite it.
 */
import { createRootRouteWithContext } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

import { BasaltShell } from 'basalt-ui'

type RouterContext = {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
})

function RootComponent() {
  return (
    <BasaltShell
      brand={{ name: '{{APP_NAME}}' }}
      sections={[
        // { label: 'Section', items: [{ label: 'Page', to: '/page', icon: <Icon /> }] }
      ]}
    />
  )
}
