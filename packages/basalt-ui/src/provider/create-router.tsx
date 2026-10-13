/**
 * `createBasaltRouter` — the router + QueryClient wiring (V2-SPEC § 2). One `QueryClient` per call
 * (so an SSR entry gets one per request), carried on `context.queryClient`, plus the router
 * defaults basalt owns: intent preloading with Query-owned freshness, scroll restoration, and the
 * pending / error / not-found components.
 */
import { Button, Center, Loader, Stack, Text } from '@mantine/core'
import type { QueryClient, QueryClientConfig } from '@tanstack/react-query'
import { Router, createRouter } from '@tanstack/react-router'
import type { AnyRoute, ErrorComponentProps, RouterHistory } from '@tanstack/react-router'
import { toErrorMessage } from '../common/errors'
import { makeQueryClient } from '../query-client'
import { errorName, now, routerTelemetry } from '../telemetry'

/** The root route's context: `createRootRouteWithContext<BasaltRouterContext>()`. */
export type BasaltRouterContext = {
  queryClient: QueryClient
}

type BasaltRouter<TRouteTree extends AnyRoute> = Router<
  TRouteTree,
  'never',
  false,
  RouterHistory,
  Record<string, any> // oxlint-disable-line typescript/no-explicit-any -- TanStack's own default
>

function PendingComponent() {
  return (
    <Center py="xl">
      <Loader size="sm" />
    </Center>
  )
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <Stack align="flex-start" gap="xs" p="md">
      <Text fw={600}>Something went wrong</Text>
      <Text c="dimmed" size="sm">
        {toErrorMessage(error)}
      </Text>
      <Button size="compact-sm" variant="default" onClick={reset}>
        Try again
      </Button>
    </Stack>
  )
}

function NotFoundComponent() {
  return (
    <Stack gap={4} p="md">
      <Text fw={600}>Page not found</Text>
      <Text c="dimmed" size="sm">
        This address does not match any page.
      </Text>
    </Stack>
  )
}

/**
 * @example
 * const router = createBasaltRouter({ routeTree })
 * declare module '@tanstack/react-router' {
 *   interface Register { router: typeof router }
 * }
 * // extra context (argo's auth) extends BasaltRouterContext:
 * const router = createBasaltRouter({ routeTree, context: { auth }, query: { queryCache } })
 */
export function createBasaltRouter<
  TRouteTree extends AnyRoute,
  TContext extends object = Record<never, never>,
>(options: {
  routeTree: TRouteTree
  /** Context beyond `queryClient`; the root route's context type extends `BasaltRouterContext`. */
  context?: TContext
  /** Merged over basalt's QueryClient defaults (`staleTime` 30 s, `gcTime` 5 min, `retry` 2, no refetch on focus). */
  query?: QueryClientConfig
  /** React owns every view transition (V2-SPEC § 5); the router's would interrupt it. */
  defaultViewTransition?: never
}): BasaltRouter<TRouteTree> {
  const queryClient = makeQueryClient(options.query)
  const router: BasaltRouter<TRouteTree> = createRouter({
    routeTree: options.routeTree,
    context: { ...options.context, queryClient },
    defaultPreload: 'intent',
    // Query owns freshness: a preload must not be cached a second time by the router.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    defaultPendingComponent: PendingComponent,
    defaultErrorComponent: ErrorComponent,
    defaultNotFoundComponent: NotFoundComponent,
    defaultOnCatch: (error: unknown) => {
      if (process.env.NODE_ENV !== 'production') console.error('[basalt] route error', error)
      routerTelemetry(router)({
        type: 'route.error',
        failed: true,
        start: now(),
        attributes: {
          'basalt.route.id': router.state.matches.at(-1)?.routeId ?? 'unknown',
          'exception.type': errorName(error),
          'basalt.error.kind': 'route',
        },
      })
    },
  } as never)
  return router
}
