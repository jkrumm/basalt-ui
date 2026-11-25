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
 * The layout a control takes inside a group. A field drops its `w-full` so a group sizes to its
 * content; with `fill` every child grows. A button keeps its own width (an icon button stays square)
 * and only grows with `fill`. Placed before the caller's `className` in `cn`, so `grow-0` or
 * `w-40` wins.
 */
export function scopeClass(scope: ControlScope | null): string | undefined {
  if (scope === null) return undefined
  return scope.fill ? 'w-auto min-w-0 grow' : 'w-auto'
}

/**
 * A small button or copy button in a group keeps its drawn height like its neighbours and drops the
 * coarse inline margin that would open a gap; its hit area stops at its own edge, since that margin
 * no longer holds its overhang.
 */
export const GROUPED_SMALL_BUTTON = 'pointer-coarse:mx-0 pointer-coarse:after:inset-x-0'

/** A button's share of `scopeClass`: it grows in a `fill` group and keeps its own width otherwise. */
export function buttonScopeClass(scope: ControlScope | null): string | undefined {
  return scope?.fill === true ? 'grow' : undefined
}
