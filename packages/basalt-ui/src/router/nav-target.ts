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
import type { ElementType, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import type { RegisteredRouter, ValidateLinkOptions } from '@tanstack/react-router'
import type { LinkComponent } from '../core/ports'
import type { NavTarget } from '../page/contract'

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

type LinkProps = Parameters<LinkComponent>[0]

/**
 * A `LinkComponent` that also opens a `NavTarget`. Assignable wherever a `LinkComponent` is taken
 * (a function accepting a wider `href` satisfies the narrower port), and what `routerDefaults` returns.
 */
export type RouterLinkComponent = (
  props: Omit<LinkProps, 'href'> & { href: string | NavTarget },
) => ReactNode

/**
 * The router `Link` as a `LinkComponent`: a `NavTarget` becomes a typed router link, a string stays a
 * plain anchor (an external URL, a mailto, a hash). `LinkComponent` types `href: string`; this one
 * also takes a `NavTarget`, which a function accepting a wider parameter satisfies without a cast.
 * The one cast lives here: `Link` is generic over the registered route tree, and a runtime
 * `to` cannot be checked against it, because `navTarget` already did.
 */
export function RouterLinkAdapter({
  href,
  ...rest
}: Parameters<RouterLinkComponent>[0]): ReactNode {
  if (isNavTarget(href)) {
    return createElement(Link as ElementType, { ...opened.get(href), ...rest })
  }
  return createElement('a', { href, ...rest })
}
