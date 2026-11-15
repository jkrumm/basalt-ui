import { Children, isValidElement } from 'react'
import type { ReactNode } from 'react'

const STAT_TYPES = new WeakSet<object>()

/**
 * Marks a component as a stat card, so a `CardGrid` of only those draws the stat row's narrow form.
 * `page` and `cards` import each other nowhere; this module is the one place they meet.
 */
export function markStatCard<T extends object>(component: T): T {
  STAT_TYPES.add(component)
  return component
}

/** True when `children` is at least one element and every element is a marked stat card. */
export function isStatRow(children: ReactNode): boolean {
  const all = Children.toArray(children)
  return (
    all.length > 0 &&
    all.every((child) => isValidElement(child) && STAT_TYPES.has(child.type as object))
  )
}
