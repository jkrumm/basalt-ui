/**
 * `basaltRouterOptions` / `createBasaltRouter` — the router + QueryClient wiring (V2-SPEC § 2). One
 * `QueryClient` per call (so an SSR entry gets one per request), carried on `context.queryClient`,
 * plus the router defaults basalt owns: intent preloading with Query-owned freshness, scroll restoration, the
 * pending / error / not-found components, and the route view transition (direction from the
 * `BasaltShell` nav order, V2-SPEC § 5).
 */
import { Button, Center, Loader, Stack, Text } from '@mantine/core'
import type { QueryClient, QueryClientConfig } from '@tanstack/react-query'
import { Router, createRouter } from '@tanstack/react-router'
import type { AnyRoute, ErrorComponentProps, RouterHistory } from '@tanstack/react-router'
import { toErrorMessage } from '../common/errors'
import { makeQueryClient } from '../query-client'
import type { RouterHook } from '../telemetry'
import {
  guardViewTransitionRejections,
  routeViewTransition,
  supportsViewTransitionTypes,
} from './route-transition'

/** The root route's context: `createRootRouteWithContext<BasaltRouterContext>()`. */
export type BasaltRouterContext = {
  queryClient: QueryClient
  /** Set by `basaltRouterOptions`; the mounted provider points `onRouteError` at its emitter. */
  __basalt?: RouterHook
}

type BasaltRouterBase<TRouteTree extends AnyRoute> = Router<
  TRouteTree,
  'never',
  false,
  RouterHistory,
  Record<string, any> // oxlint-disable-line typescript/no-explicit-any -- TanStack's own default
>

declare const basaltRouterBrand: unique symbol

/**
 * What `createBasaltRouter` returns, and the only router `BasaltProvider` accepts. The brand is
 * type-level only: a plain `createRouter(...)` has the same shape without it and fails to compile,
 * because the provider needs the `queryClient` context and the defaults `createBasaltRouter` sets.
 *
 * The route-tree default is TanStack's own `AnyRouter` shape (`any`): a specific tree is not
 * assignable to `AnyRoute`, and `BasaltProvider` accepts any tree.
 */
export type BasaltRouter<
  TRouteTree extends AnyRoute = any, // oxlint-disable-line typescript/no-explicit-any -- see JSDoc
> = BasaltRouterBase<TRouteTree> & {
  readonly [basaltRouterBrand]: true
}

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

/** The options `createBasaltRouter` owns. Each is `never` on it: basalt's, not a consumer knob. */
type ManagedKeys =
  | 'defaultPreload'
  | 'defaultPreloadStaleTime'
  | 'scrollRestoration'
  | 'defaultPendingComponent'
  | 'defaultErrorComponent'
  | 'defaultNotFoundComponent'
  | 'defaultOnCatch'
  | 'defaultViewTransition' // route transitions are basalt's (V2-SPEC § 5): the router's would double them

type RouterOptionsInput<TContext extends object> = {
  /** Context beyond `queryClient`; the root route's context type extends `BasaltRouterContext`. */
  context?: TContext | undefined
  /** Merged over basalt's QueryClient defaults (`staleTime` 30 s, `gcTime` 5 min, `retry` twice, never a 4xx, no refetch on focus). */
  query?: QueryClientConfig | undefined
}

/**
 * Everything `createBasaltRouter` sets, for a router the app builds itself (TanStack Start's
 * `getRouter()`): spread it into `createRouter`, and the provider mounted inside gets `route.error`
 * telemetry, intent preloading, the route transition and the default pending/error/not-found UI.
 * Side effect, once per document: wraps `document.startViewTransition` so a skipped route
 * transition (`AbortError`) never becomes an unhandled rejection (`guardViewTransitionRejections`).
 *
 * @example
 * export const getRouter = () => createRouter({ routeTree, ...basaltRouterOptions() })
 */
export function basaltRouterOptions<TContext extends object = Record<never, never>>(
  options: RouterOptionsInput<TContext> = {},
) {
  guardViewTransitionRejections()
  const hook: RouterHook = {}
  return {
    context: {
      ...options.context,
      queryClient: makeQueryClient(options.query),
      __basalt: hook,
    } as TContext & BasaltRouterContext,
    defaultPreload: 'intent' as const,
    // Query owns freshness: a preload must not be cached a second time by the router.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    // Route changes only; React's `<ViewTransition>` stays for in-page changes (the aside fold).
    // Types-gated: without `:active-view-transition-type()` the router would crossfade the whole page.
    defaultViewTransition: supportsViewTransitionTypes() ? routeViewTransition : false,
    defaultPendingComponent: PendingComponent,
    defaultErrorComponent: ErrorComponent,
    defaultNotFoundComponent: NotFoundComponent,
    defaultOnCatch: (error: unknown) => {
      if (process.env.NODE_ENV !== 'production') console.error('[basalt] route error', error)
      hook.onRouteError?.(error)
    },
  }
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
>({
  routeTree,
  context,
  query,
  ...passthrough
}: RouterOptionsInput<TContext> & {
  routeTree: TRouteTree
  history?: RouterHistory
  basepath?: string
} & { [K in ManagedKeys]?: never }): BasaltRouter<TRouteTree> {
  return createRouter({
    ...passthrough,
    routeTree,
    ...basaltRouterOptions({ context, query }),
  }) as BasaltRouter<TRouteTree>
}
