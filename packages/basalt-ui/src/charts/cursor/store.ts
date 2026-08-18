/**
 * The shared chart cursor — an external store, not a React context value.
 *
 * Sharing used to require a `ChartHoverSync` ancestor, so it was opt-in and silently absent
 * whenever someone forgot the wrapper. This inverts that: a module-level store means every
 * chart on the page shares a cursor by default, and `ChartCursorScope` exists to ISOLATE a
 * subtree (`docs/CHARTS-SPEC.md` §3). Charts with non-overlapping domains never resolve each
 * other's keys, so "shared by default" cannot produce a false cursor.
 *
 * External store rather than context for a second reason: a cursor move re-renders only the
 * charts subscribed to it, instead of every descendant of a provider whose value object is new
 * on each pointer frame.
 */

/** Broadcast cursor position: an opaque domain key plus the chart that owns it. */
export type CursorState = {
  /** The hovered x-domain key (a date/category string), or null when nothing is hovered. */
  key: string | null
  /** `chartId` of the chart the pointer is actually over — the one that owns the tooltip. */
  source: string | null
}

export type CursorStore = {
  get: () => CursorState
  set: (key: string | null, source: string | null) => void
  subscribe: (onChange: () => void) => () => void
}

/** Stable identity for "nothing hovered" — also the SSR snapshot, so it must never be recreated. */
export const EMPTY_CURSOR: CursorState = { key: null, source: null }

export function createCursorStore(): CursorStore {
  let state: CursorState = EMPTY_CURSOR
  const listeners = new Set<() => void>()

  return {
    get: () => state,
    set: (key, source) => {
      if (state.key === key && state.source === source) return
      state = key === null && source === null ? EMPTY_CURSOR : { key, source }
      for (const listener of listeners) listener()
    },
    subscribe: (onChange) => {
      listeners.add(onChange)
      return () => {
        listeners.delete(onChange)
      }
    },
  }
}

/** The default store every chart shares unless a `ChartCursorScope` overrides it. */
export const globalCursorStore: CursorStore = createCursorStore()
