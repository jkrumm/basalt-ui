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

/** A pattern segment: a path literal (case-insensitive), a given param value (case-sensitive), or a wildcard. */
type Part = { kind: 'literal' | 'value'; text: string } | { kind: 'param' | 'optional' | 'splat' }

/** `to` as parts, with the item's own `params` interpolated; the unspecified stay wildcards. */
function patternOf(item: NavItem): Part[] {
  const params: unknown = item.link.params
  const given = (typeof params === 'object' && params !== null ? params : {}) as Record<
    string,
    unknown
  >
  return segmentsOf(item.link.to).map((segment): Part => {
    if (segment === '$') return { kind: 'splat' }
    const param = /^\{?(-?)\$([\w-]+)\}?$/.exec(segment)
    if (param === null) return { kind: 'literal', text: segment.toLowerCase() }
    const value = given[param[2] ?? '']
    if (value !== undefined) return { kind: 'value', text: String(value) }
    return { kind: param[1] === '-' ? 'optional' : 'param' }
  })
}

/** The path, once: each segment as written and lower-cased. */
type PathSegment = { raw: string; lower: string }

function matchParts(parts: Part[], path: PathSegment[], at: number, fuzzy: boolean): boolean {
  const [part, ...rest] = parts
  if (part === undefined) return fuzzy || at === path.length
  if (part.kind === 'splat') return true
  if (part.kind === 'optional' && matchParts(rest, path, at, fuzzy)) return true
  const actual = path[at]
  if (actual === undefined) return false
  if (part.kind === 'literal' && part.text !== actual.lower) return false
  if (part.kind === 'value' && part.text !== actual.raw) return false
  return matchParts(rest, path, at + 1, fuzzy)
}

/**
 * Whether the path is on `item`: the sidebar's rule (`use-nav.ts` `matchOf`: `matchRoute` with
 * `fuzzy: exact !== true && to !== '/'`, the item's `params` applied, case-insensitive) as a pure
 * string match, because the router's own matcher only answers for its current location.
 */
function onItem(item: NavItem, path: PathSegment[]): boolean {
  const fuzzy = item.exact !== true && item.link.to !== '/'
  return matchParts(patternOf(item), path, 0, fuzzy)
}

/**
 * The flattened-nav index of the item that owns `pathname`, picked as the sidebar picks its active
 * item: of the matches, the most specific (most non-empty segments in `link.to`) wins and the first
 * in definition order takes a tie. `-1` when nothing matches.
 *
 * @internal exported for the corpus test against the router's real `matchRoute`.
 */
export function navIndexOf(flat: ReadonlyArray<NavItem>, pathname: string): number {
  const path = segmentsOf(trimTrailingSlash(pathname)).map((raw) => ({
    raw,
    lower: raw.toLowerCase(),
  }))
  let winner = -1
  let winnerSpecificity = -1
  for (const [index, item] of flat.entries()) {
    const specificity = segmentsOf(item.link.to).length
    if (specificity > winnerSpecificity && onItem(item, path)) {
      winner = index
      winnerSpecificity = specificity
    }
  }
  return winner
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
  const fromIndex = navIndexOf(flat, fromLocation.pathname)
  const toIndex = navIndexOf(flat, toLocation.pathname)
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex)
    return [ROUTE_TRANSITION_TYPES.sibling]
  return [toIndex > fromIndex ? ROUTE_TRANSITION_TYPES.forward : ROUTE_TRANSITION_TYPES.back]
}

/**
 * The router's own gate for passing `types` (router.js:495): without it the callback is never
 * called and every navigation, first load and filter changes included, gets the UA's full-page
 * crossfade. So below this support line there is no route transition at all. Server: none.
 */
export function supportsViewTransitionTypes(): boolean {
  if (typeof window === 'undefined') return false
  const css: { supports?: (condition: string) => boolean } | undefined = window.CSS
  return css?.supports?.('selector(:active-view-transition-type(a))') === true
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

/** Hands a non-skip to the page's error handlers once (`window` `error`, which `BasaltProvider` forwards). */
const reportOnce = (reason: unknown): void => {
  if (isTransitionSkip(reason)) return
  if (typeof reportError === 'function') reportError(reason)
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
 * - `ready`: a skip is swallowed; any other reason goes to `reportError`, so it surfaces once, there
 *   (a throwing handler would create a second, unowned rejection).
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
    transition.ready.catch(reportOnce)
    transition.finished.catch(ignore)
    return transition
  }
  guarded.add(wrapped)
  document.startViewTransition = wrapped
}
