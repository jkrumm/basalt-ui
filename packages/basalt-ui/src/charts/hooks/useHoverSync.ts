import { localPoint } from '@visx/event'
import { useCallback, useContext, useMemo, useRef } from 'react'
import { DEFAULT_NO_OP_SET_HOVER, HoverContext } from '../hover-context'
import { useChartTooltip } from './useChartTooltip'

type XScale = (x: string) => number | undefined

/**
 * Wires a chart into the shared-cursor HoverContext plus the local tooltip state.
 *
 * Returns everything a chart needs to:
 *   - snap mouse position to the nearest data point (by x-category)
 *   - broadcast that hover to other charts via HoverContext
 *   - read back hover from other charts (for ghost crosshair + dot)
 *   - drive its local tooltip
 *
 * Every non-sparkline chart kind MUST use this hook. Do not reimplement the
 * closest-point loop inline — drift across 15+ charts is the exact problem
 * this hook prevents.
 */
export function useHoverSync<T>({
  data,
  chartId,
  getKey,
  xScale,
  marginLeft,
}: {
  data: T[]
  chartId: string
  getKey: (d: T) => string
  xScale: XScale
  marginLeft: number
}) {
  const ctx = useContext(HoverContext)
  // Latest context in a ref so the mouse callbacks stay referentially stable: the provider's value
  // is a NEW object on every hover broadcast, and depending on `ctx` would re-create both callbacks
  // (and re-bind HoverOverlay's listeners) in every sibling chart on every cursor move.
  const ctxRef = useRef(ctx)
  ctxRef.current = ctx
  const warnedRef = useRef(false)

  if (
    process.env['NODE_ENV'] !== 'production' &&
    ctx.setHover === DEFAULT_NO_OP_SET_HOVER &&
    !warnedRef.current
  ) {
    warnedRef.current = true
    // eslint-disable-next-line no-console
    console.warn(
      '[charts] useHoverSync used outside <HoverContext.Provider>. Cross-chart cursor sync will not work.',
    )
  }

  const { tip, show, hide, tooltipRef, lastDateRef } = useChartTooltip<T>()

  // O(1) lookup of a point by its key. Under a provider every sibling resolves the broadcast
  // key each frame; an O(n) `data.find` per sibling per move is N×O(M). This makes it N×O(1).
  const pointByKey = useMemo(() => {
    const m = new Map<string, T>()
    for (const d of data) m.set(getKey(d), d)
    return m
  }, [data, getKey])

  const handleMouse = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      const point = localPoint(event)
      if (!point || data.length === 0) return
      const px = point.x - marginLeft
      let closest: T = data[0] as T
      let minDist = Infinity
      for (const d of data) {
        const sx = xScale(getKey(d)) ?? 0
        const dist = Math.abs(sx - px)
        if (dist < minDist) {
          minDist = dist
          closest = d
        }
      }
      show(closest, event)
      const key = getKey(closest)
      if (lastDateRef.current !== key) {
        lastDateRef.current = key
        ctxRef.current.setHover(key, chartId)
      }
    },
    [data, xScale, getKey, chartId, marginLeft, show, lastDateRef],
  )

  const handleLeave = useCallback(() => {
    hide()
    // Only clear the SHARED hover if this chart currently owns it. When the cursor moves quickly from
    // chart A to chart B, A's `mouseleave` can fire AFTER B's `mousemove` has already claimed the
    // hover — an unconditional clear would then wipe B's cursor and flicker every sibling crosshair.
    if (ctxRef.current.source === chartId) ctxRef.current.setHover(null, null)
  }, [hide, chartId])

  // The point the crosshair + synced dots track. Inside a <ChartHoverSync> this follows the
  // broadcast key (so every sibling paints a ghost crosshair at the same x). WITHOUT a provider the
  // chart is standalone, so it falls back to THIS chart's own hovered point (`tip.data`) — otherwise
  // a chart outside a provider would never draw a crosshair/dots at all.
  const syncedPoint = ctx.key ? (pointByKey.get(ctx.key) ?? null) : (tip?.data ?? null)
  // Which chart owns the floating tooltip. Inside a provider the hovered chart is the one whose id
  // matches the broadcast source (siblings show a ghost crosshair only). Standalone, its own local
  // hover (`tip`) drives the tooltip.
  const hasProvider = ctx.setHover !== DEFAULT_NO_OP_SET_HOVER
  const isDirectHover = hasProvider ? ctx.source === chartId : tip !== null

  return {
    tip,
    tooltipRef,
    syncedPoint,
    isDirectHover,
    handleMouse,
    handleLeave,
  }
}
