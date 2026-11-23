/**
 * `navTarget` and the link adapter. A `NavTarget` is the opaque product of `navTarget(linkOptions)`:
 * router-free subpaths (`PageBar parent`, `InnerNav`, `StatCard href`) take `string | NavTarget` and
 * hand it to a `LinkComponent`; only the adapter `routerDefaults` returns opens it. The options sit
 * in a private `WeakMap`, so the type says nothing about what a target holds and a target never
 * outlives its last reference.
 *
 * No JSX in this folder: the element is built with `createElement`.
 */
import { createElement } from 'react'
import type { ElementType, MouseEvent, ReactNode } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import type { AnyRouter, RegisteredRouter, ValidateLinkOptions } from '@tanstack/react-router'
import type { LinkComponent, NavTarget } from '../core/ports'
import { isInAppPath } from '../core/url'

export type { NavTarget }

/** `declare` keeps the brand type-only: an instance is a `NavTarget` with no field and no cast. */
class OpaqueTarget {
  declare readonly __brand: 'NavTarget'
}

const opened = new WeakMap<object, object>()

/**
 * Wraps `linkOptions({ ... })` as an opaque target for any prop typed `string | NavTarget`. The
 * options stay validated against the registered router (a typo in `to` is a compile error); the
 * target itself carries nothing a caller can read or build by hand.
 *
 * @useWhen a prop that takes a link (a breadcrumb parent, a card `href`, an inner-nav entry) must open a typed route
 * @neverWhen the destination is an external URL or a plain path string (pass the string)
 *
 * @example
 * <PageBar title="Run 12" parent={{ label: 'Runs', href: navTarget(linkOptions({ to: '/runs' })) }} />
 */
export function navTarget<const TOptions>(
  options: ValidateLinkOptions<RegisteredRouter, TOptions>,
): NavTarget {
  const target = new OpaqueTarget()
  opened.set(target, options)
  return target
}

/** Whether a value was made by `navTarget`. */
function isNavTarget(value: unknown): value is NavTarget {
  return typeof value === 'object' && value !== null && opened.has(value)
}

/**
 * The URL a target or an in-app path opens, for a store that must keep it as text (the shell's
 * favourites). `undefined` for a path that leaves the app or a target this router cannot build.
 */
export function targetHref(router: AnyRouter, target: string | NavTarget): string | undefined {
  if (typeof target === 'string') return isInAppPath(target) ? target : undefined
  const options = opened.get(target)
  if (options === undefined) return undefined
  try {
    return router.buildLocation(options as Parameters<AnyRouter['buildLocation']>[0]).href
  } catch {
    return undefined
  }
}

/** `LinkComponent` already takes a `NavTarget`; the name stays for what `routerDefaults` returns. */
export type RouterLinkComponent = LinkComponent

type LinkProps = Parameters<LinkComponent>[0]

/** The click the browser would follow itself: another button, a modifier or a new-tab link is left alone. */
function isPlainClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  const anchor = event.currentTarget
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) &&
    (anchor.target === '' || anchor.target === '_self') &&
    !anchor.hasAttribute('download')
  )
}

/**
 * A path string through the router: a real `<a href>` (middle click, copy link, no script) whose
 * plain click navigates in place, so the Query cache, the shell state and in-flight work survive.
 */
function InAppLink({ href, onClick, ...rest }: LinkProps & { href: string }): ReactNode {
  const router = useRouter({ warn: false }) as AnyRouter | undefined
  const handle = (event: MouseEvent<HTMLAnchorElement>): void => {
    ;(onClick as ((event: MouseEvent<HTMLAnchorElement>) => void) | undefined)?.(event)
    if (router === undefined || !isPlainClick(event)) return
    event.preventDefault()
    void router.navigate({ href })
  }
  return createElement('a', { href, onClick: handle, ...rest })
}

/**
 * The router `Link` as a `LinkComponent`: a `NavTarget` becomes a typed router link, an in-app path
 * (`isInAppPath`: root-relative, no backslash) navigates through the router, any other string (an
 * external URL, a mailto, a hash) stays a plain anchor. The one cast to `ElementType` lives here: `Link` is generic over the registered route
 * tree, and a runtime `to` cannot be checked against it, because `navTarget` already did.
 */
export function RouterLinkAdapter({ href, ...rest }: LinkProps): ReactNode {
  if (isNavTarget(href)) {
    // Current means this exact page: a parent's path and search are always inside the current URL's.
    return createElement(Link as ElementType, {
      activeOptions: { exact: true, includeSearch: true },
      ...opened.get(href),
      ...rest,
    })
  }
  if (isInAppPath(href)) return createElement(InAppLink, { href, ...rest })
  return createElement('a', { href, ...rest })
}
