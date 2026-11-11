/**
 * The per-router nav registry: the shell registers the declared nav against its router, and
 * `routerDefaults` reads it back. A `WeakMap` keyed on the router, so two routers (or two tests)
 * never share state and nothing leaks past the router's lifetime.
 */
import { flattenNavEntries, resolveActive } from './resolve-active'
import type { AnyNavConfig } from './types'

const registry = new WeakMap<object, AnyNavConfig>()

export function registerNav(router: object, nav: AnyNavConfig): void {
  registry.set(router, nav)
}

export function navFor(router: object): AnyNavConfig | undefined {
  return registry.get(router)
}

/**
 * Transition direction between two pathnames, from the flattened nav order. `undefined` when either
 * side resolves to no item or both land on the same one.
 */
export function navDirection(
  nav: AnyNavConfig,
  fromPathname: string,
  toPathname: string,
): 'forward' | 'back' | undefined {
  const order = flattenNavEntries(nav).map((e) => e.item.id)
  const from = resolveActive(nav, fromPathname).activeId
  const to = resolveActive(nav, toPathname).activeId
  if (from === undefined || to === undefined) return undefined
  const delta = order.indexOf(to) - order.indexOf(from)
  if (delta === 0) return undefined
  return delta > 0 ? 'forward' : 'back'
}
