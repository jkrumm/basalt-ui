/**
 * `windowKey`: a quantised `[from, to]` query key for a sliding time window, with the gated
 * placeholder that keeps the previous data across a step and never across a range or filter change.
 *
 * A window whose `to` is "now" mints a new query key on every render tick, and TanStack Query then
 * empties the page into fresh `pending` entries. Flooring `to` onto the data's own step rotates the
 * key only when a new step can exist. A bare `keepPreviousData` is wrong here: it would render the
 * outgoing `24h` numbers under a just-selected `7d` label. The gate forwards the previous data only
 * for the same query at an earlier moment: same key prefix, same span.
 *
 * The cost, stated: the returned `to` is the floored step, up to one step behind the wall clock, so
 * an age or a staleness verdict must read a real clock and never this `to`.
 */
import { keepPreviousData } from '@tanstack/react-query'
import type { QueryKey } from '@tanstack/react-query'

type TimeWindow = { from: number; to: number }

type WindowKeyOptions = {
  /** The step (ms) `to` is floored onto: the finest resolution the server's data has. */
  stepMs: number
  /** The key parts before the window (resource, target, filters). Defaults to none. */
  scope?: readonly unknown[]
}

type WindowKeyResult = TimeWindow & {
  /** `[...scope, from, to]`: the full query key. */
  queryKey: QueryKey
  /** The gated `placeholderData` for `useQuery`. */
  placeholderData: <TData>(
    previousData: TData | undefined,
    previousQuery: { queryKey: QueryKey } | undefined,
  ) => TData | undefined
}

/** Floors `to` onto `stepMs` and shifts `from` by the same delta, so the span stays exact. */
export function quantiseWindow(window: TimeWindow, stepMs: number): TimeWindow {
  const to = Math.floor(window.to / stepMs) * stepMs
  return { from: window.from - (window.to - to), to }
}

/**
 * Whether `currentKey` is the same query as `previousKey` at an earlier moment: both end
 * `[..., from, to]`, every other position is equal, and the two spans are equal. A malformed key
 * answers `false`: no placeholder, never a wrong one.
 */
export function sameWindowedQuery(
  currentKey: readonly unknown[],
  previousKey: readonly unknown[],
): boolean {
  if (currentKey.length !== previousKey.length || currentKey.length < 2) return false
  const [from, to] = currentKey.slice(-2)
  const [prevFrom, prevTo] = previousKey.slice(-2)
  if (
    typeof from !== 'number' ||
    typeof to !== 'number' ||
    typeof prevFrom !== 'number' ||
    typeof prevTo !== 'number'
  ) {
    return false
  }
  if (to - from !== prevTo - prevFrom) return false
  return currentKey.slice(0, -2).every((part, i) => part === previousKey[i])
}

/**
 * Quantises a window onto `stepMs` and returns its query key plus the gated placeholder.
 *
 * @useWhen a query is keyed by a sliding time window that would otherwise rotate its key on every tick
 * @neverWhen the window is fixed (a picked date range) or the data has no step to quantise to
 *
 * @example
 * ```ts
 * const w = windowKey(range, { stepMs: 60_000, scope: ['uptime', target] })
 * useQuery({ queryKey: w.queryKey, queryFn: () => getUptime(w), placeholderData: w.placeholderData })
 * ```
 */
export function windowKey(window: TimeWindow, options: WindowKeyOptions): WindowKeyResult {
  const { stepMs, scope = [] } = options
  if (!Number.isFinite(stepMs) || stepMs <= 0) {
    throw new RangeError(`windowKey: stepMs must be a positive number, got ${stepMs}`)
  }
  const { from, to } = quantiseWindow(window, stepMs)
  const queryKey = [...scope, from, to]
  return {
    from,
    to,
    queryKey,
    placeholderData: (previousData, previousQuery) =>
      previousQuery !== undefined && sameWindowedQuery(queryKey, previousQuery.queryKey)
        ? keepPreviousData(previousData)
        : undefined,
  }
}
