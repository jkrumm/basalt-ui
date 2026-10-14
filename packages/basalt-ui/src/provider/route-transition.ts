/**
 * Route view transitions (V2-SPEC § 5): the direction of a navigation, read off `BasaltShell` nav
 * order, plus the guard that keeps the router's discarded `ViewTransition` promises quiet.
 *
 * The router owns the call (`router-core` `startViewTransition`, router.js:490-508): it passes
 * `{ update, types }` to `document.startViewTransition` when the browser supports
 * `:active-view-transition-type()`, a bare callback otherwise, and returns only `updateCallbackDone`,
 * so `ready` and `finished` are dropped on the floor.
 */
import type { AnyRouter } from '@tanstack/react-router'
import { flattenNav, getActiveNav } from '../router-tanstack/nav'

/** The three `:active-view-transition-type()` names `styles.css` animates. Namespaced: a consumer's own cannot collide. */
export const ROUTE_TRANSITION_TYPES = {
  forward: 'basalt-forward',
  back: 'basalt-back',
  sibling: 'basalt-sibling',
} as const

/** The argument of the router's `types` callback, derived from its own option type. */
type RouterLocationChange = Parameters<
  Extract<
    Extract<AnyRouter['options']['defaultViewTransition'], object>['types'],
    (...args: never[]) => unknown
  >
>[0]

/** The part of it the direction reads: two pathnames and whether the path changed. */
type LocationChange = Pick<RouterLocationChange, 'pathChanged'> & {
  fromLocation?: Pick<NonNullable<RouterLocationChange['fromLocation']>, 'pathname'>
  toLocation: Pick<RouterLocationChange['toLocation'], 'pathname'>
}

type ActiveNav = NonNullable<ReturnType<typeof getActiveNav>>
type NavItem = ReturnType<typeof flattenNav>[number]

const trimTrailingSlash = (path: string): string =>
  path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path

const segmentsOf = (path: string): string[] => path.split('/').filter(Boolean)

/**
 * Whether `pathname` is on `item`: the sidebar's rule (`use-nav.ts` `matchOf`: `matchRoute` with
 * `fuzzy: exact !== true && to !== '/'`, case-insensitive) over a pure string match, because the
 * router's own matcher only answers for its current location. `$param` matches one segment and a
 * bare `$` the rest of the path.
 */
function onItem(item: NavItem, pathname: string): boolean {
  const to = segmentsOf(item.link.to.toLowerCase())
  const path = segmentsOf(pathname.toLowerCase())
  const fuzzy = item.exact !== true && item.link.to !== '/'
  for (const [i, segment] of to.entries()) {
    if (segment === '$') return true
    const actual = path[i]
    if (actual === undefined) return false
    if (!segment.startsWith('$') && segment !== actual) return false
  }
  return fuzzy || path.length === to.length
}

/**
 * The flattened-nav index of the item that owns `pathname`, picked as the sidebar picks its active
 * item: of the matches, the most specific (most non-empty segments in `link.to`) wins and the first
 * in definition order takes a tie. `-1` when nothing matches.
 */
function navIndexOf(flat: ReadonlyArray<NavItem>, pathname: string): number {
  let best = -1
  let bestSpecificity = -1
  flat.forEach((item, index) => {
    const specificity = segmentsOf(item.link.to).length
    if (specificity > bestSpecificity && onItem(item, trimTrailingSlash(pathname))) {
      best = index
      bestSpecificity = specificity
    }
  })
  return best
}

/**
 * The `types` callback for the router's `defaultViewTransition`. Pure: the nav is a parameter.
 *
 * - No `fromLocation`: the first load. The router also runs it through `startViewTransition`
 *   (load-client.js:916), but there is no previous page to animate from, so `false`.
 * - Same path (search or hash only): `false`, the page does not change.
 * - A later nav item than the one you left: `forward`; an earlier one: `back`.
 * - Same item (a detail beneath it), or either side outside the nav: `sibling`, a plain crossfade.
 */
export function routeTransitionTypes(
  { fromLocation, toLocation, pathChanged }: LocationChange,
  nav: ActiveNav | undefined,
): string[] | false {
  if (!fromLocation || !pathChanged) return false
  const flat = nav ? flattenNav(nav) : []
  const from = navIndexOf(flat, fromLocation.pathname)
  const to = navIndexOf(flat, toLocation.pathname)
  if (from === -1 || to === -1 || from === to) return [ROUTE_TRANSITION_TYPES.sibling]
  return [to > from ? ROUTE_TRANSITION_TYPES.forward : ROUTE_TRANSITION_TYPES.back]
}

/**
 * The router's own gate for passing `types` (router.js:495): without it the callback is never
 * called and every navigation, first load and filter changes included, gets the UA's full-page
 * crossfade. So below this support line there is no route transition at all. Server: none.
 */
export function supportsViewTransitionTypes(): boolean {
  if (typeof window === 'undefined') return false
  return window.CSS?.supports?.('selector(:active-view-transition-type(a))') === true
}

/** What `createBasaltRouter` hands the router as `defaultViewTransition`. */
export const routeViewTransition = {
  types: (change: LocationChange) => routeTransitionTypes(change, getActiveNav()),
}

// ── rejection guard ──────────────────────────────────────────────────────────────────────────────

/** The three ways a transition ends early: superseded (`AbortError`), document hidden/detached, timed out. */
const SKIP_NAMES = new Set(['AbortError', 'InvalidStateError', 'TimeoutError'])

const isTransitionSkip = (reason: unknown): boolean =>
  reason instanceof DOMException && SKIP_NAMES.has(reason.name)

/** Swallows a skip and rethrows anything else, so a real error still reaches `unhandledrejection`. */
const ignoreSkip = (reason: unknown): void => {
  if (!isTransitionSkip(reason)) throw reason
}

/** `finished` repeats whatever `ready` or `updateCallbackDone` already reported; never report it twice. */
const ignore = (): void => {}

const guarded = new WeakSet<object>()

/**
 * Attaches a catch to `ready` and `finished` of every `document.startViewTransition` call, once per
 * installed function (idempotent across routers). Router-core drops both (it returns only
 * `updateCallbackDone`), and a superseded transition rejects them with `AbortError: Transition was
 * skipped` (router discussion #7733), which `window` `unhandledrejection` — and so basalt's
 * telemetry sink — would report.
 *
 * - `ready`: a skip is swallowed; any other reason is rethrown, so it surfaces once, there.
 * - `finished`: always swallowed. A non-skip reason is the update callback's error, which `ready`
 *   (and, for the router, its own `await updateCallbackDone`) already carries.
 * - `updateCallbackDone` is left alone: the router awaits it, and a catch here would re-raise a
 *   real error from a derived promise nobody owns.
 *
 * Chosen over an `unhandledrejection` filter because it removes the rejection at its source: it
 * never becomes unhandled, so no listener (basalt's, a consumer's, devtools) sees it, and
 * `preventDefault()` on a shared event would hide real rejections from the others. The wrapper
 * returns the original `ViewTransition`. A no-op where the API is absent, and on the server.
 */
export function guardViewTransitionRejections(): void {
  if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') return
  if (guarded.has(document.startViewTransition)) return
  const original = document.startViewTransition.bind(document)
  const wrapped: Document['startViewTransition'] = (...args) => {
    const transition = original(...args)
    transition.ready.catch(ignoreSkip)
    transition.finished.catch(ignore)
    return transition
  }
  guarded.add(wrapped)
  document.startViewTransition = wrapped
}
