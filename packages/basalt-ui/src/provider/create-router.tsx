/**
 * `basaltRouterOptions` / `createBasaltRouter` — the router + QueryClient wiring (V2-SPEC § 2). One
 * `QueryClient` per call (so an SSR entry gets one per request), carried on `context.queryClient`,
 * plus the router defaults basalt owns: intent preloading with Query-owned freshness, scroll restoration, the
 * pending / error / not-found components, and the route view transition (direction from the
 * `BasaltShell` nav order, V2-SPEC § 5).
 */
import type { QueryClient, QueryClientConfig } from '@tanstack/react-query'
import { Router, createRouter } from '@tanstack/react-router'
import type { AnyRoute, RouterHistory } from '@tanstack/react-router'
import { makeQueryClient } from '../query-client'
import type { RouterHook } from '../telemetry'
import { ErrorComponent, NotFoundComponent, PendingComponent } from './route-defaults'
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

/** The options `createBasaltRouter` owns. Each is `never` on it: basalt's, not a consumer knob. */
type ManagedKeys = Exclude<keyof BasaltRouterOptions, 'context'>

/** `queryClient` and `__basalt` are basalt's: a consumer's would be replaced, so the type rejects them. */
type ExtraContext = { queryClient?: never; __basalt?: never }
type NoContext = Record<never, never>

type RouterOptionsInput<TContext extends object> = {
  /** Context beyond `queryClient`; the root route's context type extends `BasaltRouterContext`. */
  context?: (TContext & ExtraContext) | undefined
  /** Merged over basalt's QueryClient defaults (`staleTime` 30 s, `gcTime` 5 min, `retry` twice, never a 4xx but 408/425/429, no refetch on focus). */
  query?: QueryClientConfig | undefined
}

/** What `basaltRouterOptions` returns: the router options basalt owns, plus the context. */
export type BasaltRouterOptions<TContext extends object = NoContext> = {
  context: TContext & BasaltRouterContext
  defaultPreload: 'intent'
  defaultPreloadStaleTime: number
  scrollRestoration: boolean
  /** Route transitions are basalt's (V2-SPEC § 5): the router's own would double them. */
  defaultViewTransition: typeof routeViewTransition | false
  defaultPendingComponent: typeof PendingComponent
  defaultErrorComponent: typeof ErrorComponent
  defaultNotFoundComponent: typeof NotFoundComponent
  defaultOnCatch: (error: unknown) => void
}

/**
 * Everything `createBasaltRouter` sets, for a router the app builds itself (TanStack Start's
 * `getRouter()`): spread it into `createRouter`, and the provider mounted inside gets `route.error`
 * telemetry, intent preloading, the route transition and the default pending/error/not-found UI.
 * A `TContext` with required keys makes `context` required. Spread it LAST: the keys are basalt's.
 * Side effect, once per document: wraps `document.startViewTransition` so a skipped route
 * transition (`AbortError`) never becomes an unhandled rejection (`guardViewTransitionRejections`).
 *
 * @example
 * export const getRouter = () => createRouter({ routeTree, ...basaltRouterOptions() })
 */
export function basaltRouterOptions(options?: RouterOptionsInput<NoContext>): BasaltRouterOptions
export function basaltRouterOptions<TContext extends object>(
  options: RouterOptionsInput<TContext> & { context: TContext & ExtraContext },
): BasaltRouterOptions<TContext>
export function basaltRouterOptions<TContext extends object>(
  options: RouterOptionsInput<TContext> = {},
): BasaltRouterOptions<TContext> {
  return buildRouterOptions(options)
}

function buildRouterOptions<TContext extends object>(
  options: RouterOptionsInput<TContext>,
): BasaltRouterOptions<TContext> {
  guardViewTransitionRejections()
  const hook: RouterHook = {}
  // The overloads of `basaltRouterOptions` and `createBasaltRouter` make `context` present whenever
  // `TContext` has required keys, so the spread is the whole `TContext`: the one cast, here.
  const context = {
    ...options.context,
    queryClient: makeQueryClient(options.query),
    __basalt: hook,
  } as TContext & BasaltRouterContext
  return {
    context,
    defaultPreload: 'intent',
    // Query owns freshness: a preload must not be cached a second time by the router.
    defaultPreloadStaleTime: 0,
    scrollRestoration: true,
    // Route changes only; React's `<ViewTransition>` stays for in-page changes (the aside fold).
    // Types-gated: without `:active-view-transition-type()` the router would crossfade the whole page.
    defaultViewTransition: supportsViewTransitionTypes() ? routeViewTransition : false,
    defaultPendingComponent: PendingComponent,
    defaultErrorComponent: ErrorComponent,
    defaultNotFoundComponent: NotFoundComponent,
    defaultOnCatch: (error) => {
      // Unbound (before the provider's first effect): the console is the only report, in every env.
      if (process.env.NODE_ENV !== 'production' || !hook.onRouteError)
        console.error('[basalt] route error', error)
      hook.onRouteError?.(error)
    },
  }
}

type CreateRouterInput<TRouteTree extends AnyRoute> = {
  routeTree: TRouteTree
  history?: RouterHistory
  basepath?: string
} & { [K in ManagedKeys]?: never }

/**
 * @example
 * const router = createBasaltRouter({ routeTree })
 * declare module '@tanstack/react-router' {
 *   interface Register { router: typeof router }
 * }
 * // extra context (argo's auth) extends BasaltRouterContext:
 * const router = createBasaltRouter({ routeTree, context: { auth }, query: { queryCache } })
 */
export function createBasaltRouter<TRouteTree extends AnyRoute>(
  options: CreateRouterInput<TRouteTree> & RouterOptionsInput<NoContext>,
): BasaltRouter<TRouteTree>
export function createBasaltRouter<TRouteTree extends AnyRoute, TContext extends object>(
  options: CreateRouterInput<TRouteTree> &
    RouterOptionsInput<TContext> & { context: TContext & ExtraContext },
): BasaltRouter<TRouteTree>
export function createBasaltRouter<TRouteTree extends AnyRoute, TContext extends object>({
  routeTree,
  context,
  query,
  ...passthrough
}: CreateRouterInput<TRouteTree> & RouterOptionsInput<TContext>): BasaltRouter<TRouteTree> {
  const router: BasaltRouterBase<TRouteTree> = createRouter({
    ...passthrough,
    routeTree,
    ...buildRouterOptions<TContext>({ context, query }),
  })
  // The brand is type-level only (see `BasaltRouter`), so the one cast adds nothing at runtime.
  return router as BasaltRouter<TRouteTree>
}
