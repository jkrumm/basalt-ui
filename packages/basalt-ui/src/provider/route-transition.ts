/**
 * Route view transitions (V2-SPEC § 5): the direction of a navigation, read off `BasaltShell` nav
 * order, plus the guard that keeps the router's discarded `ViewTransition` promises quiet.
 *
 * The router owns the call (`router-core` `startViewTransition`, router.js:490-508): it passes
 * `{ update, types }` to `document.startViewTransition` when the browser supports
 * `:active-view-transition-type()`, a bare callback otherwise, and returns only `updateCallbackDone`,
 * so `ready` and `finished` are dropped on the floor.
 */
import type { ParsedLocation } from '@tanstack/react-router'
import { flattenNav, getActiveNav } from '../router-tanstack/nav'
import type { AnyNavGroup } from '../router-tanstack/nav'

/** The three `:active-view-transition-type()` names `styles.css` animates. Namespaced: a consumer's own cannot collide. */
export const ROUTE_TRANSITION_TYPES = {
  forward: 'basalt-forward',
  back: 'basalt-back',
  sibling: 'basalt-sibling',
} as const

type LocationChange = {
  fromLocation?: Pick<ParsedLocation, 'pathname'>
  toLocation: Pick<ParsedLocation, 'pathname'>
  pathChanged: boolean
}

type NavConfig = { groups: ReadonlyArray<AnyNavGroup> }

const trimTrailingSlash = (path: string): string =>
  path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path

/**
 * The flattened-nav index of the item that owns `pathname`: the longest matching `link.to`, where an
 * item matches itself and (unless `exact`, or `'/'`) everything beneath it — the same rule as the
 * sidebar's `isActive`. `-1` when nothing matches.
 */
function navIndexOf(
  flat: ReadonlyArray<{ link: { to: string }; exact?: boolean }>,
  pathname: string,
): number {
  const path = trimTrailingSlash(pathname)
  let best = -1
  let bestLength = -1
  flat.forEach(({ link, exact }, index) => {
    const to = trimTrailingSlash(link.to)
    const hit = path === to || (!exact && to !== '/' && path.startsWith(`${to}/`))
    if (hit && to.length > bestLength) {
      best = index
      bestLength = to.length
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
  nav: NavConfig | undefined,
): string[] | false {
  if (!fromLocation || !pathChanged) return false
  const flat = nav ? flattenNav(nav) : []
  const from = navIndexOf(flat, fromLocation.pathname)
  const to = navIndexOf(flat, toLocation.pathname)
  if (from === -1 || to === -1 || from === to) return [ROUTE_TRANSITION_TYPES.sibling]
  return [to > from ? ROUTE_TRANSITION_TYPES.forward : ROUTE_TRANSITION_TYPES.back]
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

const guarded = new WeakSet<object>()

/**
 * Attaches a skip-only catch to `ready`, `finished` and `updateCallbackDone` of every
 * `document.startViewTransition` call, once per installed function (idempotent across routers). Router-core drops the first two and a
 * superseded transition rejects them with `AbortError: Transition was skipped` (router discussion
 * #7733), which `window` `unhandledrejection` — and so basalt's telemetry sink — would report.
 *
 * Chosen over an `unhandledrejection` filter because it removes the rejection at its source: the
 * rejection never becomes unhandled, so no listener (basalt's, a consumer's, devtools) sees it, and
 * `preventDefault()` on a shared event would hide real rejections from the others. The wrapper
 * changes no result: it returns the original `ViewTransition`, and `updateCallbackDone` is still
 * rejected for the router's own `await`. A no-op where the API is absent, and on the server.
 */
export function guardViewTransitionRejections(): void {
  if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') return
  if (guarded.has(document.startViewTransition)) return
  const original = document.startViewTransition.bind(document)
  const wrapped: Document['startViewTransition'] = (...args) => {
    const transition = original(...args)
    transition.ready.catch(ignoreSkip)
    transition.finished.catch(ignoreSkip)
    transition.updateCallbackDone.catch(ignoreSkip)
    return transition
  }
  guarded.add(wrapped)
  document.startViewTransition = wrapped
}
