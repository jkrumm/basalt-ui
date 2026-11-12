import type { QueryClient } from '@tanstack/react-query'
import { Outlet, createRootRouteWithContext } from '@tanstack/react-router'
import { OverlayHost, ToastHost } from 'basalt-ui/page'
import { OVERLAYS } from './overlays'

export const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => (
    <>
      <Outlet />
      <OverlayHost overlays={OVERLAYS} />
      <ToastHost />
    </>
  ),
})
