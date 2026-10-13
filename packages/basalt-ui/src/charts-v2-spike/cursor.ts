import { createChartCursor, cursorHost } from '@tanstack/charts/cursor'
import type { ChartCursorController } from '@tanstack/charts/cursor'
import { resolveChartFocusStrategy } from '@tanstack/charts/cursor/host'
import type {
  ChartCursorBinding,
  ChartFocusStrategy,
  ChartValue,
} from '@tanstack/charts/types/core'

type Controller = ChartCursorController<Date, number>
type CursorState = ReturnType<Controller['getState']>

/**
 * Shared by default: every chart joins the `'default'` group unless it names another. A module
 * map, not a React context — nothing to mount, identical on server and client.
 */
const groups = new Map<string, Controller>()

export function cursorController(group = 'default'): Controller {
  let controller = groups.get(group)
  if (!controller) {
    controller = createChartCursor<Date, number>()
    groups.set(group, controller)
  }
  return controller
}

/**
 * Which chart published a state. Keyed by the state OBJECT (never a copy): TanStack's cleanup
 * clears only the exact object a host published, so the stamp must not change identity.
 * Programmatic states (an app timeline via `cursorController().setState`) have no owner, so every
 * chart treats them as foreign.
 */
const owners = new WeakMap<object, string>()

const stamp = (state: CursorState, chartId: string): CursorState => {
  if (state) owners.set(state, chartId)
  return state
}

export function isForeign(group: string | undefined, chartId: string): boolean {
  const state = cursorController(group).getState()
  return state !== null && owners.get(state) !== chartId
}

/** How a sibling's cursor value lands on this chart's x keys (1.x `cursorResolution`). */
export type CursorResolution = 'exact' | 'nearest' | 'leading'

/**
 * Each chart's view of its group's controller. Two jobs:
 *  - stamp what this chart publishes with its id (ownership, above);
 *  - snap a foreign value onto THIS chart's keys. TanStack resolves a shared value by exact match
 *    only, so a weekly chart following a daily one would paint an unsnapped rule. Identity is
 *    preserved: the same object when no snap is needed, one memoized copy otherwise.
 */
export function chartCursorView(
  group: string | undefined,
  chartId: string,
  keys: readonly Date[],
  mode: CursorResolution,
): Controller {
  const shared = cursorController(group)
  const ts = keys.map((d) => d.getTime()).toSorted((a, b) => a - b)
  const memo = new WeakMap<object, CursorState>()
  const snap = (t: number): number => {
    let i = ts.findLastIndex((k) => k <= t)
    if (mode === 'nearest' && i < ts.length - 1 && (i < 0 || ts[i + 1]! - t < t - ts[i]!)) i += 1
    return ts[Math.max(i, 0)]!
  }
  return {
    subscribe: (listener) => shared.subscribe(listener),
    setState: (next) =>
      shared.setState(
        typeof next === 'function' ? (prev) => stamp(next(prev), chartId) : stamp(next, chartId),
      ),
    getState: () => {
      const state = shared.getState()
      const x = state?.anchor === 'value' ? state.value.x : undefined
      if (!state || mode === 'exact' || ts.length === 0 || !(x instanceof Date)) return state
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

/**
 * Source-only tooltips. The host shows a tooltip (and its `role="status"` live region) exactly
 * when it resolves a focus point, and it resolves a shared cursor's point through the definition's
 * focus strategy. Wrapping the built-in `group-x` strategy so it groups nothing while a FOREIGN
 * state is current leaves a follower with the crosshair (painted from the cursor presentation, not
 * from focus) and nothing else.
 */
export function sourceOnlyFocus(group: string | undefined, chartId: string): ChartFocusStrategy {
  const base = resolveChartFocusStrategy<unknown, ChartValue, ChartValue>('group-x')
  if (!base) throw new Error('group-x focus strategy missing')
  return {
    resolve: (points, context) => base.resolve(points, context),
    navigation: (points) => base.navigation(points),
    group: (points, context) => (isForeign(group, chartId) ? [] : base.group(points, context)),
  }
}

export function cursorBinding(
  group: string | undefined,
  chartId: string,
  keys: readonly Date[],
  mode: CursorResolution,
): ChartCursorBinding<unknown, Date, number> {
  return {
    use: cursorHost,
    controller: chartCursorView(group, chartId, keys, mode),
    mode: 'focus' as const,
    match: 'x' as const,
  }
}
