import { createContext, useContext } from 'react'

/**
 * What a control group (`ui/control-group`) hands the controls inside it. A control resolves each
 * axis as its own prop, then the group's, then its default, so a child opts out of the group by
 * passing its own value: unlike a class cascade, nothing the group sets is final.
 */
export type ControlScope = {
  /** The group's `size`; a control's own `size` wins. */
  size?: 'md' | 'sm' | undefined
  /** The group's button `variant`; a button's own `variant` wins. Fields have one look and ignore it. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | undefined
  /** Every child grows to share the row; `className="grow-0"` keeps one at its own width. */
  fill: boolean
}

const ControlScopeContext = createContext<ControlScope | null>(null)

/** Provides the scope; rendered by the group components only. */
export const ControlScopeProvider = ControlScopeContext.Provider

/** The enclosing group's scope, or null outside a group. */
export function useControlScope(): ControlScope | null {
  return useContext(ControlScopeContext)
}

/**
 * The layout a control takes inside a group: it drops its `w-full` so a group sizes to its content,
 * grows with the others in a `fill` group, and, under a coarse pointer, lifts to the 44 px floor its
 * neighbours have. Placed before the caller's `className` in `cn`, so `grow-0` or `w-40` wins.
 */
export function scopeClass(scope: ControlScope | null): string | undefined {
  if (scope === null) return undefined
  return scope.fill ? 'w-auto min-w-0 grow' : 'w-auto'
}
