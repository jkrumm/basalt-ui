/**
 * The shared cursor (`docs/V2-SPEC.md` § 9.4). One TanStack `createChartCursor()` per group in a
 * module map — no provider. Every chart joins `'default'` unless it names a `cursorGroup`.
 *
 * CLIENT-ONLY BY CONSTRUCTION. The map is module state, so on a server it would be shared by every
 * concurrent request. Without `window`, `chartCursor()` is the inert controller (null state, no-op
 * set/subscribe) and no entry is created. The engine never reads a binding during SSR anyway:
 * `prerender()` renders the scene, and the binding is consumed by `mountChartRenderer` from a layout
 * effect. Bindings resolve their controller per call, never at compile time.
 *
 * TEARDOWN. A group's entry is refcounted by its live `subscribe` registrations; the last
 * unsubscribe drops it one microtask later (a host re-binding unsubscribes before it resubscribes,
 * and must not lose the group's state in between). Only `subscribe` creates an entry: `getState` on
 * a missing group returns `null` and `setState` on one is a no-op.
 */
import { createChartCursor, cursorHost } from '@tanstack/charts/cursor'
import type { ChartCursorController } from '@tanstack/charts/cursor'
import { resolveChartFocusStrategy } from '@tanstack/charts/cursor/host'
import type {
  ChartCursorBinding,
  ChartFocusStrategy,
  ChartValue,
} from '@tanstack/charts/types/core'
import type { ChartX, CursorResolution } from './types'

type CursorState = ReturnType<ChartCursorController['getState']>

type Entry = { controller: ChartCursorController; subscribers: number }

const groups = new Map<string, Entry>()
const facades = new Map<string, ChartCursorController>()

const INERT: ChartCursorController = {
  getState: () => null,
  setState: () => {},
  subscribe: () => () => {},
}

const isServer = (): boolean => typeof window === 'undefined'

function ensure(group: string): Entry {
  let entry = groups.get(group)
  if (!entry) {
    entry = { controller: createChartCursor(), subscribers: 0 }
    groups.set(group, entry)
  }
  return entry
}

function facade(group: string): ChartCursorController {
  return {
    getState: () => groups.get(group)?.controller.getState() ?? null,
    // No subscriber, no entry: a write to a group nothing listens to would only leak one.
    setState: (next) => groups.get(group)?.controller.setState(next),
    subscribe: (listener) => {
      const entry = ensure(group)
      entry.subscribers += 1
      const unsubscribe = entry.controller.subscribe(listener)
      let live = true
      return () => {
        if (!live) return
        live = false
        unsubscribe()
        entry.subscribers -= 1
        if (entry.subscribers > 0) return
        queueMicrotask(() => {
          if (entry.subscribers === 0 && groups.get(group) === entry) groups.delete(group)
        })
      }
    },
  }
}

/**
 * The cursor controller for a group (default `'default'`), for app-side sync — a map timeline that
 * follows the charts, or drives them:
 *
 * ```ts
 * const cursor = chartCursor()
 * const state = useSyncExternalStore(cursor.subscribe, cursor.getState, () => null)
 * ```
 *
 * The same object for the same group, so `useSyncExternalStore` never resubscribes per render. On
 * the server it is inert.
 */
export function chartCursor(group = 'default'): ChartCursorController {
  if (isServer()) return INERT
  let controller = facades.get(group)
  if (!controller) {
    controller = facade(group)
    facades.set(group, controller)
  }
  return controller
}

/** Test seam: whether a group currently has an entry. */
export const hasCursorGroup = (group: string): boolean => groups.has(group)

/**
 * Which chart published a state, keyed by the state OBJECT: TanStack clears only the exact object a
 * host published, so a stamp must never change its identity. A programmatic state (an app timeline)
 * has no owner, so every chart treats it as foreign.
 */
const owners = new WeakMap<object, string>()

function stamp(state: CursorState, chartId: string): CursorState {
  if (state) owners.set(state, chartId)
  return state
}

export function isForeign(group: string | undefined, chartId: string): boolean {
  const state = chartCursor(group).getState()
  return state !== null && owners.get(state) !== chartId
}

const valueX = (state: CursorState): ChartValue | undefined =>
  state?.anchor === 'value' ? state.value.x : undefined

/** Snaps a foreign x value onto this chart's own x values; `null` = no snap (exact). */
function snapper(
  keys: readonly ChartX[],
  mode: CursorResolution,
): ((x: ChartValue) => ChartValue | undefined) | null {
  const first = keys[0]
  if (first === undefined || typeof first === 'string') return null
  const isDate = first instanceof Date
  const ts = keys
    .map((k) => (k instanceof Date ? k.getTime() : (k as number)))
    .toSorted((a, b) => a - b)
  return (x) => {
    // Charts whose x value types differ never sync (the 1.x `DomainKind` partition).
    if (isDate !== x instanceof Date) return undefined
    if (!isDate && typeof x !== 'number') return undefined
    if (mode === 'exact') return x
    const t = x instanceof Date ? x.getTime() : (x as number)
    let i = ts.findLastIndex((k) => k <= t)
    if (
      mode === 'nearest' &&
      i < ts.length - 1 &&
      (i < 0 || (ts[i + 1] as number) - t < t - (ts[i] as number))
    )
      i += 1
    const snapped = ts[Math.max(i, 0)] as number
    if (snapped === t) return x
    return isDate ? new Date(snapped) : snapped
  }
}

type Snap = { snap: ReturnType<typeof snapper>; memo: WeakMap<object, CursorState> }
type View = { controller: ChartCursorController; config: Snap; subscribers: number }

/** One stable view per mounted chart: TanStack compares the binding's controller by reference and
 * re-creates the cursor session when it changes, so a fresh object per compile would reset it on
 * every re-render. Recompiling only swaps the view's snapping config. */
const views = new Map<string, View>()

function makeView(
  group: string | undefined,
  chartId: string,
  config: () => Snap,
  onSubscribers?: (delta: 1 | -1) => void,
): ChartCursorController {
  // Resolved per call, never at build time: a definition compiled during SSR holds no controller.
  const shared = (): ChartCursorController => chartCursor(group)
  return {
    subscribe: (listener) => {
      const unsubscribe = shared().subscribe(listener)
      onSubscribers?.(1)
      let live = true
      return () => {
        if (!live) return
        live = false
        unsubscribe()
        onSubscribers?.(-1)
      }
    },
    setState: (next) =>
      shared().setState(
        typeof next === 'function' ? (prev) => stamp(next(prev), chartId) : stamp(next, chartId),
      ),
    getState: () => {
      const state = shared().getState()
      const x = valueX(state)
      const { snap, memo } = config()
      if (!state || !snap || x === undefined) return state
      const hit = memo.get(state)
      if (hit !== undefined) return hit
      const snapped = snap(x)
      const next = snapped === x ? state : snappedState(state, snapped)
      memo.set(state, next)
      return next
    },
  }
}

/** A foreign value of another x type never shows (`undefined`); otherwise a copy at the snap. */
function snappedState(state: NonNullable<CursorState>, x: ChartValue | undefined): CursorState {
  if (x === undefined) return null
  return { ...state, value: { ...state.value, x } }
}

/**
 * Each chart's view of its group's controller. Two jobs:
 *  - stamp what this chart publishes with its id (ownership, above);
 *  - snap a foreign value onto THIS chart's x values. TanStack matches a shared value exactly, so a
 *    weekly chart following a daily one would paint an unsnapped rule. State identity is preserved:
 *    the same object when no snap is needed, one memoized copy otherwise.
 *
 * The view object itself is stable per `group` + `chartId` on the client (see `views`); its entry
 * is dropped a microtask after its last subscription ends, or after its creation if nothing
 * subscribed by then.
 */
export function chartCursorView(
  group: string | undefined,
  chartId: string,
  keys: readonly ChartX[],
  mode: CursorResolution,
): ChartCursorController {
  const config: Snap = { snap: snapper(keys, mode), memo: new WeakMap() }
  if (isServer()) return makeView(group, chartId, () => config)
  const id = `${group ?? 'default'}\u0000${chartId}`
  const existing = views.get(id)
  if (existing) {
    existing.config = config
    return existing.controller
  }
  const view: View = { controller: INERT, config, subscribers: 0 }
  // Swept unless subscribed by then — a chart rendering a `state` placeholder compiles a view it
  // never mounts, and must not leave a permanent entry.
  const sweep = (): void =>
    queueMicrotask(() => {
      if (view.subscribers === 0 && views.get(id) === view) views.delete(id)
    })
  view.controller = makeView(
    group,
    chartId,
    () => view.config,
    (delta) => {
      view.subscribers += delta
      if (view.subscribers === 0) sweep()
    },
  )
  views.set(id, view)
  sweep()
  return view.controller
}

/**
 * Source-only tooltips. A 1.1.0 host shows a tooltip (and its `role="status"` live region) exactly
 * when it resolves a focus point, and it resolves a shared cursor's point through the definition's
 * focus strategy. Wrapping `group-x` so it groups nothing while a FOREIGN state is current leaves a
 * follower with the crosshair (painted from the cursor presentation, not from focus) and nothing
 * else.
 */
export function sourceOnlyFocus(group: string | undefined, chartId: string): ChartFocusStrategy {
  const base = resolveChartFocusStrategy<unknown, ChartValue, ChartValue>('group-x')
  if (!base) throw new Error('[basalt] charts: the group-x focus strategy is missing')
  return {
    resolve: (points, context) => base.resolve(points, context),
    navigation: (points) => base.navigation(points),
    group: (points, context) => (isForeign(group, chartId) ? [] : base.group(points, context)),
  }
}

export function cursorBinding(opts: {
  group: string | undefined
  chartId: string
  keys: readonly ChartX[]
  mode: CursorResolution
  /** Activation pins and unpins the cursor — on for a coarse pointer (§ 9.6: tap to pin). */
  pin: boolean
}): ChartCursorBinding {
  return {
    use: cursorHost,
    controller: chartCursorView(opts.group, opts.chartId, opts.keys, opts.mode),
    mode: 'focus',
    match: 'x',
    pin: opts.pin,
  }
}

/** Test seam: whether a chart's view entry exists. */
export const hasCursorView = (group: string | undefined, chartId: string): boolean =>
  views.has(`${group ?? 'default'}\u0000${chartId}`)
