import { createChartCursor, cursorHost } from '@tanstack/charts/cursor'
import type { ChartCursorController } from '@tanstack/charts/cursor'
import type { ChartCursorBinding } from '@tanstack/charts/types/core'

/**
 * Shared by default: every chart joins the `'default'` group unless it names another. A module
 * map, not a React context — nothing to mount, identical on server and client.
 */
const groups = new Map<string, ChartCursorController<Date, number>>()

export function cursorController(group = 'default'): ChartCursorController<Date, number> {
  let controller = groups.get(group)
  if (!controller) {
    controller = createChartCursor<Date, number>()
    groups.set(group, controller)
  }
  return controller
}

export function cursorBinding(
  group: string | undefined,
  keys: readonly Date[],
  mode: CursorResolution,
): ChartCursorBinding<unknown, Date, number> {
  return {
    use: cursorHost,
    controller: resolvingController(cursorController(group), keys, mode),
    mode: 'focus' as const,
    match: 'x' as const,
  }
}

/** How a sibling's cursor value lands on this chart's x keys (1.x `cursorResolution`). */
export type CursorResolution = 'exact' | 'nearest' | 'leading'

/**
 * TanStack resolves a shared value by exact match only: a weekly chart following a daily one
 * paints an unsnapped crosshair and focuses no point. The controller is structural
 * (get/set/subscribe), so basalt hands each chart a view that snaps the value onto ITS keys.
 * Identity is preserved (same object when no snap is needed, one memoized copy otherwise) —
 * TanStack's cleanup clears only the exact state object a host published.
 */
export function resolvingController(
  shared: ChartCursorController<Date, number>,
  keys: readonly Date[],
  mode: CursorResolution,
): ChartCursorController<Date, number> {
  if (mode === 'exact' || keys.length === 0) return shared
  const ts = keys.map((d) => d.getTime()).toSorted((a, b) => a - b)
  const memo = new WeakMap<object, ReturnType<typeof shared.getState>>()
  const snap = (t: number): number => {
    let i = ts.findLastIndex((k) => k <= t)
    if (mode === 'nearest' && i < ts.length - 1 && (i < 0 || ts[i + 1]! - t < t - ts[i]!)) i += 1
    return ts[Math.max(i, 0)]!
  }
  return {
    subscribe: (listener) => shared.subscribe(listener),
    setState: (next) => shared.setState(next),
    getState: () => {
      const state = shared.getState()
      const x = state?.anchor === 'value' ? state.value.x : undefined
      if (!state || !(x instanceof Date)) return state
      const snapped = snap(x.getTime())
      if (snapped === x.getTime()) return state
      const hit = memo.get(state)
      if (hit) return hit
      const copy = { ...state, value: { ...state.value, x: new Date(snapped) } }
      memo.set(state, copy)
      return copy
    },
  }
}
