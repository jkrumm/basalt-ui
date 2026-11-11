/**
 * One stable anchor component per nav item. A fresh component per render is a new component TYPE to
 * React, which unmounts the `<a>` and drops the focus of the link the user just activated, so the
 * anchor is built once per item OBJECT (a `WeakMap`, not keyed on id and not per render). That is
 * why `defineNav` belongs at module scope. Nothing per-render is closed over; the resolver's verdict
 * arrives as the `aria-current` prop.
 *
 * No JSX in this folder: the element is built with `createElement`.
 */
import { createElement } from 'react'
import type { ComponentPropsWithoutRef, ElementType, ReactElement } from 'react'
import { Link } from '@tanstack/react-router'
import type { AnyNavItem } from './types'

export type NavAnchor = (props: ComponentPropsWithoutRef<'a'>) => ReactElement

const anchors = new WeakMap<AnyNavItem, NavAnchor>()

export function navAnchor(item: AnyNavItem): NavAnchor {
  const cached = anchors.get(item)
  if (cached) return cached
  // `exact: true` makes the resolver the only authority on active: a `Link` spreads its own
  // `aria-current` LAST and cannot be overridden from outside, so a prefix-matching parent would
  // otherwise claim the page beside its child. `Link as ElementType` is the one cast in the chain.
  const Anchor: NavAnchor = (props) =>
    createElement(Link as ElementType, {
      ...item.link,
      activeOptions: { exact: true, includeSearch: true },
      ...props,
    })
  anchors.set(item, Anchor)
  return Anchor
}
