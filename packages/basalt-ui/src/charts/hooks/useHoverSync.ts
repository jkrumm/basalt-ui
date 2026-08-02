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
  resolveKey,
}: {
  data: T[]
  chartId: string
  getKey: (d: T) => string
  xScale: XScale
  marginLeft: number
  /**
   * Overrides how a SIBLING's broadcast key resolves to one of THIS chart's own points. Only
   * affects reading another chart's hover — this chart's own hover (via `getKey`/`xScale`) is
   * untouched.
   *
   * Cross-chart sync is exact string match by default (`pointByKey.get(ctx.key)`), so two charts
   * share a cursor only if they emit identical key strings. A chart that downsamples/folds its
   * domain to fit a narrow viewport (e.g. ~288 buckets folded into ~97 columns at 390px) no longer
   * owns most of the keys its unfolded siblings broadcast — the shared crosshair then appears on
   * roughly one hover in three, with no rule a reader can infer, which is worse than no shared
   * cursor at all. Pass `resolveKey` to map a foreign key onto whichever of this chart's own points
   * swallowed it (e.g. the folded bucket the key falls into).
   *
   * Omit it and behaviour is byte-identical to today.
   */
  resolveKey?: (key: string) => T | null
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

  // Latest accessors in refs, same reasoning as `ctxRef` above: the natural call style is an
  // inline arrow for `getKey`/`xScale`, which is fresh on every render, and this file already
  // pays for that hazard once (see the comment above `ctxRef`) without applying the fix here — a
  // several-hundred-entry `pointByKey` Map was rebuilding on every render of a page that
  // re-renders on a heartbeat. Trade-off: because `getKey` is read through a ref, changing key
  // SEMANTICS without changing `data` will NOT rebuild the map. That's the intended trade — a
  // `getKey` that changes meaning for the same data is pathological; a `getKey` that changes
  // identity every render is the normal case.
  const getKeyRef = useRef(getKey)
  getKeyRef.current = getKey
  const xScaleRef = useRef(xScale)
  xScaleRef.current = xScale

  // O(1) lookup of a point by its key. Under a provider every sibling resolves the broadcast
  // key each frame; an O(n) `data.find` per sibling per move is N×O(M). This makes it N×O(1).
  const pointByKey = useMemo(() => {
    const m = new Map<string, T>()
    for (const d of data) m.set(getKeyRef.current(d), d)
    return m
  }, [data])

  const handleMouse = useCallback(
    (event: React.MouseEvent<SVGRectElement>) => {
      const point = localPoint(event)
      if (!point || data.length === 0) return
      const px = point.x - marginLeft
      let closest: T = data[0] as T
      let minDist = Infinity
      for (const d of data) {
        const sx = xScaleRef.current(getKeyRef.current(d)) ?? 0
        const dist = Math.abs(sx - px)
        if (dist < minDist) {
          minDist = dist
          closest = d
        }
      }
      show(closest, event)
      const key = getKeyRef.current(closest)
      if (lastDateRef.current !== key) {
        lastDateRef.current = key
        ctxRef.current.setHover(key, chartId)
      }
    },
    [data, chartId, marginLeft, show, lastDateRef],
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
  // a chart outside a provider would never draw a crosshair/dots at all. When `resolveKey` is
  // supplied it replaces the default exact-match lookup for reading a SIBLING's broadcast key (see
  // its doc comment above) — this chart's own hover is unaffected either way.
  const syncedPoint = ctx.key
    ? resolveKey
      ? resolveKey(ctx.key)
      : (pointByKey.get(ctx.key) ?? null)
    : (tip?.data ?? null)
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
