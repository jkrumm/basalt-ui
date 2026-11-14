import { createRouter } from '@tanstack/react-router'

export const router = createRouter({
  routeTree,
  defaultErrorComponent: ErrorView,
  defaultNotFoundComponent: NotFoundView,
  defaultPendingComponent: PendingView,
})
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
