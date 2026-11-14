/**
 * `routerDefaults`: the TanStack router options basalt holds, as a plain object, and the link
 * adapter. No wrapper, no brand, no re-exports: `createRouter({ routeTree, ...options })` is the
 * whole wiring, and the app keeps `Wrap`, the pending, error and not-found components (they use
 * Query and `ui/*`, which `./router` may not import).
 *
 * Without a `defaultPendingComponent` the 300/300 timer never arms and nothing renders (router-core
 * `load-client`), so the three components are seeded by `init` and checked by `doctor` (check 12).
 *
 * No JSX in this folder.
 */
import { RouterLinkAdapter } from './nav-target'
import type { RouterLinkComponent } from './nav-target'
import { navDirection, navFor } from './nav/registry'

/** The three `:active-view-transition-type()` names `styles.css` animates. */
export const ROUTE_TRANSITION_TYPES = {
  forward: 'basalt-forward',
  back: 'basalt-back',
  sibling: 'basalt-sibling',
} as const

/** The part of the router's location-change info the types callback reads. */
export type RouteChange = {
  fromLocation?: { pathname: string } | undefined
  toLocation: { pathname: string }
  pathChanged: boolean
}

/** Every option `routerDefaults` sets; spread it into `createRouter`. */
export type RouterDefaultOptions = {
  defaultPreload: 'intent'
  /** Query owns freshness: a preload must not be cached a second time by the router. */
  defaultPreloadStaleTime: 0
  defaultPendingMs: 300
  defaultPendingMinMs: 300
  defaultStructuralSharing: true
  scrollRestoration: true
  /** Scroll regions the router resets and restores, marked `data-scroll-restoration-id`. */
  scrollToTopSelectors: string[]
  /** `false` where the browser lacks `:active-view-transition-type()`: the router would crossfade the whole page. */
  defaultViewTransition: { types: (change: RouteChange) => string[] | false } | false
}

export type RouterDefaultsInput = {
  /**
   * The router the options go into, read lazily at navigation time (it does not exist yet when the
   * options are built): `routerDefaults({ router: () => router })`. It gives the transition its
   * direction from the nav `AppShell` registered; without it every route change is a sibling crossfade.
   */
  router?: () => object | undefined
}

const SELECTOR = '[data-scroll-restoration-id]'

function supportsViewTransitionTypes(): boolean {
  if (typeof window === 'undefined') return false
  const css: { supports?: (condition: string) => boolean } | undefined = window.CSS
  return css?.supports?.('selector(:active-view-transition-type(a))') === true
}

/**
 * The `types` callback: none on first load or when only search or hash changed; `forward` or `back`
 * by the order of the nav items the two paths resolve to; `sibling` (a plain crossfade) otherwise.
 */
export function routeTransitionTypes(
  { fromLocation, toLocation, pathChanged }: RouteChange,
  router: object | undefined,
): string[] | false {
  if (fromLocation === undefined || !pathChanged) return false
  const nav = router === undefined ? undefined : navFor(router)
  const direction =
    nav === undefined ? undefined : navDirection(nav, fromLocation.pathname, toLocation.pathname)
  return [
    direction === undefined ? ROUTE_TRANSITION_TYPES.sibling : ROUTE_TRANSITION_TYPES[direction],
  ]
}

/**
 * The router options basalt holds and the `LinkComponent` that opens a `navTarget`.
 *
 * @useWhen an app on TanStack Router builds its router, so preloading, pending timing, scroll restoration and route transitions are set once
 * @neverWhen the app has no router (pages take the plain-anchor `LinkComponent` default)
 *
 * @example
 * const { options, link } = routerDefaults({ router: () => router })
 * export const router = createRouter({
 *   routeTree,
 *   ...options,
 *   defaultPendingComponent: RoutePending,
 *   defaultErrorComponent: RouteError,
 *   defaultNotFoundComponent: RouteMissing,
 * })
 */
export function routerDefaults(input: RouterDefaultsInput = {}): {
  options: RouterDefaultOptions
  link: RouterLinkComponent
} {
  const { router = () => undefined } = input
  return {
    options: {
      defaultPreload: 'intent',
      defaultPreloadStaleTime: 0,
      defaultPendingMs: 300,
      defaultPendingMinMs: 300,
      defaultStructuralSharing: true,
      scrollRestoration: true,
      scrollToTopSelectors: [SELECTOR],
      defaultViewTransition: supportsViewTransitionTypes()
        ? { types: (change) => routeTransitionTypes(change, router()) }
        : false,
    },
    link: RouterLinkAdapter,
  }
}
