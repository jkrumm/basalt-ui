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
import { tooltip } from '@tanstack/charts/tooltip'
import type { ChartTooltipExtension } from '@tanstack/charts/tooltip'
import type { ChartCursorBinding, ChartValue } from '@tanstack/charts/types/core'
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

/** Drops `key` a microtask after its entry idles: a host re-binding releases before it re-acquires. */
function sweepWhenIdle<E extends { subscribers: number }>(
  map: Map<string, E>,
  key: string,
  entry: E,
): void {
  queueMicrotask(() => {
    if (entry.subscribers === 0 && map.get(key) === entry) map.delete(key)
  })
}

/** Counts a live subscription; the returned release runs `unsubscribe` once, sweeping at zero. */
function retain<E extends { subscribers: number }>(
  map: Map<string, E>,
  key: string,
  entry: E,
  unsubscribe: () => void,
): () => void {
  entry.subscribers += 1
  let live = true
  return () => {
    if (!live) return
    live = false
    unsubscribe()
    entry.subscribers -= 1
    if (entry.subscribers === 0) sweepWhenIdle(map, key, entry)
  }
}

function ensure(group: string): Entry {
  let entry = groups.get(group)
  if (!entry) {
    entry = { controller: createChartCursor(), subscribers: 0 }
    groups.set(group, entry)
  }
  return entry
}

const facade = (group: string): ChartCursorController => ({
  getState: () => groups.get(group)?.controller.getState() ?? null,
  // No subscriber, no entry: a write to a group nothing listens to would only leak one.
  setState: (next) => groups.get(group)?.controller.setState(next),
  subscribe: (listener) => {
    const entry = ensure(group)
    return retain(groups, group, entry, entry.controller.subscribe(listener))
  },
})

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

/**
 * Snaps a foreign x value onto this chart's own x values; `null` = no snap (a string x). A value
 * outside the rendered x extent (`extent`; a caller with none gets the keys' own) resolves to
 * `undefined`: the chart claims no datum at an x it does not cover, so it draws neither crosshair
 * nor dots. The edges are inside. Only keys inside the extent are candidates, so a snap never lands
 * on a datum the chart does not render; with none inside, a snapping mode resolves to `undefined`.
 */
function snapper(
  keys: readonly ChartX[],
  mode: CursorResolution,
  extent?: readonly [number, number],
): ((x: ChartValue) => ChartValue | undefined) | null {
  const first = keys[0]
  if (typeof first === 'string') return null
  const ts = keys
    .map((k) => (k instanceof Date ? k.getTime() : (k as number)))
    .toSorted((a, b) => a - b)
  const [lo, hi] = extent ?? [ts[0], ts.at(-1)]
  if (lo === undefined || hi === undefined) return null
  const inside = ts.filter((k) => k >= lo && k <= hi)
  // No keys to read the x type from (an extent-only chart): either type is compared by its time.
  const isDate = first === undefined ? undefined : first instanceof Date
  return (x) => {
    // Charts whose x value types differ never sync (the 1.x `DomainKind` partition).
    if (isDate !== undefined && isDate !== x instanceof Date) return undefined
    if (!(x instanceof Date) && typeof x !== 'number') return undefined
    const t = x instanceof Date ? x.getTime() : x
    if (t < lo || t > hi) return undefined
    if (mode === 'exact') return x
    const last = inside.length - 1
    if (last < 0) return undefined
    let i = inside.findLastIndex((k) => k <= t)
    if (
      mode === 'nearest' &&
      i < last &&
      (i < 0 || (inside[i + 1] as number) - t < t - (inside[i] as number))
    )
      i += 1
    const snapped = inside[Math.max(i, 0)] as number
    if (snapped === t) return x
    return x instanceof Date ? new Date(snapped) : snapped
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
  track: (unsubscribe: () => void) => () => void = (unsubscribe) => unsubscribe,
): ChartCursorController {
  // Resolved per call, never at build time: a definition compiled during SSR holds no controller.
  const shared = (): ChartCursorController => chartCursor(group)
  return {
    subscribe: (listener) => track(shared().subscribe(listener)),
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

export type CursorViewOptions = {
  group: string | undefined
  chartId: string
  keys: readonly ChartX[]
  mode: CursorResolution
  /** The x extent the chart renders (`xDomain`, else the data's); default: the keys' own. */
  extent?: readonly [number, number] | undefined
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
export function chartCursorView(opts: CursorViewOptions): ChartCursorController {
  const { group, chartId } = opts
  const config: Snap = { snap: snapper(opts.keys, opts.mode, opts.extent), memo: new WeakMap() }
  if (isServer()) return makeView(group, chartId, () => config)
  const id = `${group ?? 'default'}\u0000${chartId}`
  const existing = views.get(id)
  if (existing) {
    existing.config = config
    return existing.controller
  }
  const view: View = { controller: INERT, config, subscribers: 0 }
  view.controller = makeView(
    group,
    chartId,
    () => view.config,
    (unsubscribe) => retain(views, id, view, unsubscribe),
  )
  views.set(id, view)
  // Swept unless subscribed by then — a chart rendering a `state` placeholder compiles a view it
  // never mounts, and must not leave a permanent entry.
  sweepWhenIdle(views, id, view)
  return view.controller
}

/**
 * The extra key a chart puts on its tooltip options to name itself to {@link quietWhileFollowing}.
 * Absent, the tooltip paints for followers too.
 */
export type TooltipFollowerOptions = {
  readonly follower?: { readonly group: string | undefined; readonly chartId: string } | undefined
}

const isFollowerOptions = (options: unknown): options is TooltipFollowerOptions => {
  if (typeof options !== 'object' || options === null || !('follower' in options)) return false
  const { follower } = options
  return (
    follower === undefined ||
    (typeof follower === 'object' &&
      follower !== null &&
      'group' in follower &&
      'chartId' in follower &&
      typeof follower.chartId === 'string')
  )
}

/**
 * The tooltip options a chart spreads next to `use: quietWhileFollowing`: its identity, unless the
 * chart opted into following tooltips (`tooltip.onFollow`). The one place `onFollow` is read for
 * this, shared by `compileCartesian` and the panel rung.
 */
export function followerOptions(
  tooltip: { onFollow?: boolean | undefined } | false | null | undefined,
  group: string | undefined,
  chartId: string,
): TooltipFollowerOptions {
  const onFollow = typeof tooltip === 'object' && tooltip !== null && tooltip.onFollow === true
  return onFollow ? {} : ({ follower: { group, chartId } } satisfies TooltipFollowerOptions)
}

/**
 * The engine's DOM tooltip host, silent while this chart FOLLOWS another's cursor. A follower
 * resolves the leader's focus group (so the engine draws the same dots at the shared x); the host
 * would then paint a tooltip and fill its `role="status"` live region. Whenever `isForeign` holds,
 * this wrapper calls the host's `hide()` instead of `paint()`: a follower that has never led never
 * creates the element, and one that has led keeps it in the DOM, hidden. Otherwise (leader, no
 * `follower` option, or after the leader clears) it defers to the host.
 *
 * The chart's identity arrives only through `update` (the engine calls it before every `paint`);
 * a `paint` before the first `update` has nothing to tell it who is leading, so it hides.
 *
 * It wraps `create`/`update`/`paint` of the engine's tooltip host, whose lifecycle is undocumented:
 * re-check this wrapper, the live region included, on every `@tanstack/charts` upgrade.
 */
export const quietWhileFollowing: ChartTooltipExtension = {
  ...tooltip,
  create: (context) => {
    const host = tooltip.create(context)
    let configured = false
    let follower: TooltipFollowerOptions['follower']
    return {
      ...host,
      update: (options) => {
        configured = true
        follower = isFollowerOptions(options) ? options.follower : undefined
        host.update(options)
      },
      paint: (paint) => {
        if (!configured || (follower && isForeign(follower.group, follower.chartId))) host.hide()
        else host.paint(paint)
      },
    }
  },
}

export function cursorBinding(
  opts: CursorViewOptions & {
    /** Activation pins and unpins the cursor — on for a coarse pointer (§ 9.6: tap to pin). */
    pin: boolean
  },
): ChartCursorBinding {
  return {
    use: cursorHost,
    controller: chartCursorView(opts),
    mode: 'focus',
    match: 'x',
    pin: opts.pin,
  }
}

/** Test seam: whether a chart's view entry exists. */
export const hasCursorView = (group: string | undefined, chartId: string): boolean =>
  views.has(`${group ?? 'default'}\u0000${chartId}`)
