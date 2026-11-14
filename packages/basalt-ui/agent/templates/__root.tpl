/**
 * TanStack Router root route. `RouterContext` types what `createRouter({ context })` carries (the
 * app's `QueryClient`); extend it for your own context. The frame is the pathless `_app` layout
 * (`_app.tsx`), so routes outside it (a sign-in page) render with no shell.
 *
 * Scaffold written by `basalt-ui init` to `src/routes/__root.tsx`. This file is yours — `basalt-ui sync` will not overwrite it.
 */
import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'

export type RouterContext = { queryClient: QueryClient }

export const Route = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
})
