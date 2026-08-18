import { localPoint } from '@visx/event'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { CursorResolution } from '../cursor/resolve'
import { buildDomainIndex, resolveCursorPoint } from '../cursor/resolve'
import { useCursorState, useCursorStore } from '../cursor/scope'

/** Viewport-space pointer anchor the tooltip positions against. */
export type CursorAnchor = { x: number; y: number }

export type ChartCursor<T> = {
  /** The point this chart paints its crosshair + dots at — own hover, or a resolved sibling key. */
  point: T | null
  /** True when the pointer is over THIS chart. Only the source chart shows the floating tooltip. */
  isSource: boolean
  /** Latest pointer position in viewport coords, or null when not hovered. */
  anchor: CursorAnchor | null
  onPointerMove: (event: PointerEvent<SVGRectElement>) => void
  onPointerLeave: () => void
  onKeyDown: (event: KeyboardEvent<SVGRectElement>) => void
  onBlur: () => void
}

/**
 * Wires a chart into the ambient cursor store: snaps the pointer to the nearest own point,
 * broadcasts it, and reads back a sibling's broadcast through domain-aware resolution. Replaces
 * the removed `useHoverSync` + `useChartTooltip` pair, including their `resolveKey` escape hatch —
 * resolution is now automatic.
 *
 * The tooltip anchor is coalesced through `requestAnimationFrame`, so a fast scrub costs one local
 * state write per frame instead of one per event. The BROADCAST is not rAF-gated — it is deduped
 * instead (the store ignores a set that doesn't change the value), so a scrub within one x-bucket
 * costs nothing while a real bucket change reaches siblings on the same tick rather than a frame
 * late.
 */
export function useChartCursor<T>({
  data,
  chartId,
  getKey,
  xScale,
  marginLeft,
  resolution = 'nearest',
}: {
  data: readonly T[]
  chartId: string
  getKey: (d: T) => string
  /** Own x scale — maps a domain key to a plot-local x offset. */
  xScale: (key: string) => number | undefined
  marginLeft: number
  /**
   * How a sibling's broadcast key resolves against this chart's own points. Default `'nearest'`
   * (point domains). Pass `'leading'` when `getKey` returns a bucket's leading edge (a weekly
   * series keyed by its Monday, a monthly series keyed by its 1st) — see {@link CursorResolution}.
   */
  resolution?: CursorResolution
}): ChartCursor<T> {
  const store = useCursorStore()
  const cursor = useCursorState()
  const [anchor, setAnchor] = useState<CursorAnchor | null>(null)

  // Accessors read through refs so the pointer callbacks stay referentially stable: the natural
  // call style is an inline arrow, fresh every render, and re-creating these would re-bind the
  // overlay's listeners on every cursor frame in every sibling chart.
  const getKeyRef = useRef(getKey)
  getKeyRef.current = getKey
  const xScaleRef = useRef(xScale)
  xScaleRef.current = xScale

  const index = useMemo(
    () => buildDomainIndex(data, getKeyRef.current, resolution),
    [data, resolution],
  )

  const frameRef = useRef<number | null>(null)
  const pendingRef = useRef<CursorAnchor | null>(null)
  useEffect(
    () => () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
      // Release the shared cursor if this chart still owns it. Unmounting while hovered (a filter
      // drops the chart, a tab switches) fires no leave/blur, so the store would keep pointing at
      // a dead chartId — and any sibling whose domain resolves that stale key would paint a ghost
      // crosshair with no way to clear it. Same ownership guard as `clear()`.
      if (store.get().source === chartId) store.set(null, null)
    },
    [store, chartId],
  )

  const scheduleAnchor = useCallback((next: CursorAnchor) => {
    pendingRef.current = next
    if (frameRef.current !== null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      setAnchor(pendingRef.current)
    })
  }, [])

  const onPointerMove = useCallback(
    (event: PointerEvent<SVGRectElement>) => {
      if (data.length === 0) return
      // Explicit reference node: `localPoint(event)` resolves it from `event.target`, which is the
      // overlay rect only while the overlay is genuinely the topmost hit element. Passing
      // `currentTarget` pins the coordinate space to the overlay regardless of what a kind draws
      // above it.
      const local = localPoint(event.currentTarget, event.nativeEvent)
      if (local === null) return
      const px = local.x - marginLeft

      let closest = data[0] as T
      let minDist = Infinity
      for (const d of data) {
        const x = xScaleRef.current(getKeyRef.current(d)) ?? 0
        const dist = Math.abs(x - px)
        if (dist < minDist) {
          minDist = dist
          closest = d
        }
      }

      scheduleAnchor({ x: event.clientX, y: event.clientY })
      store.set(getKeyRef.current(closest), chartId)
    },
    [data, marginLeft, chartId, store, scheduleAnchor],
  )

  const clear = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    pendingRef.current = null
    setAnchor(null)
    // Only clear the SHARED cursor if this chart still owns it: moving fast from chart A to B lets
    // A's leave fire after B's move, and an unconditional clear would wipe B's cursor.
    if (store.get().source === chartId) store.set(null, null)
  }, [store, chartId])

  const onKeyDown = useCallback(
    (event: KeyboardEvent<SVGRectElement>) => {
      if (data.length === 0) return
      if (event.key === 'Escape') {
        clear()
        return
      }
      const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
      if (delta === 0) return
      event.preventDefault()

      const current = store.get().key
      const currentIndex = data.findIndex((d) => getKeyRef.current(d) === current)
      const nextIndex = Math.min(
        Math.max((currentIndex === -1 ? (delta > 0 ? -1 : data.length) : currentIndex) + delta, 0),
        data.length - 1,
      )
      const next = data[nextIndex] as T
      const rect = event.currentTarget.getBoundingClientRect()
      const x = xScaleRef.current(getKeyRef.current(next)) ?? 0
      scheduleAnchor({ x: rect.left + x, y: rect.top })
      store.set(getKeyRef.current(next), chartId)
    },
    [data, store, chartId, clear, scheduleAnchor],
  )

  const point = cursor.key === null ? null : resolveCursorPoint(index, cursor.key)

  return {
    point,
    isSource: cursor.source === chartId,
    anchor,
    onPointerMove,
    onPointerLeave: clear,
    onKeyDown,
    onBlur: clear,
  }
}
