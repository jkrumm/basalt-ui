import type { scalePoint } from '@visx/scale'

/**
 * The point-scale instance type, derived from `@visx/scale`'s own `scalePoint` return type.
 * Equivalent to d3's `ScalePoint<string>` but resolved through `@visx/scale` (an installed dep) so
 * it needs no `@types/d3-scale` and stays inside the visx-only-in-charts boundary.
 */
type PointScale = ReturnType<typeof scalePoint<string>>

export type XZoneSpec = {
  /** Left edge — a domain key produced by the kind's `getX`. Omit for "start of the plot area". */
  from?: string
  /** Right edge — a domain key produced by the kind's `getX`. Omit for "end of the plot area". */
  to?: string
  fill: string
  /**
   * `'center'` (default, unchanged behaviour) resolves a present bound to `xScale(key)` — the
   * point's own center, so a band reads "from this sample to that sample" rather than
   * edge-to-edge. `'edge'` resolves a present `from` to `xScale(from) - step/2` and a present `to`
   * to `xScale(to) + step/2` (`step` read from `xScale.step()`), so the band covers both terminal
   * slots in full — a two-key band widens by exactly one step, and `from === to` renders one step
   * wide instead of being skipped as degenerate. An omitted `from`/`to` still resolves to the plot
   * edge (`xScale.range()[0]`/`[1]`) in both modes, unshifted — omission means "the plot's own
   * edge", not "the first/last sample's edge". A resolved `'edge'` bound is clamped into the plot
   * range so a band anchored at the first or last sample cannot paint outside the plot area.
   */
  align?: 'center' | 'edge'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

/**
 * Resolves one zone bound (`from` or `to`) to a pixel x. `edgeSign` is `-1` for `from` (subtract
 * half a step) and `+1` for `to` (add half a step) — only consulted in `'edge'` mode.
 */
function resolveBound({
  key,
  omittedEdge,
  xScale,
  align,
  edgeSign,
  rangeMin,
  rangeMax,
}: {
  key: string | undefined
  omittedEdge: number
  xScale: PointScale
  align: 'center' | 'edge'
  edgeSign: -1 | 1
  rangeMin: number
  rangeMax: number
}): number | undefined {
  if (key === undefined) return omittedEdge
  const center = xScale(key)
  if (center === undefined) return undefined
  if (align === 'center') return center
  return clamp(center + edgeSign * (xScale.step() / 2), rangeMin, rangeMax)
}

/**
 * Vertical zone backgrounds (x-range overlays — twilight bands, a shaded time window) — one
 * <rect> per zone, spanning y=[0, height] and x=[scale(from), scale(to)]. The x analog of
 * `ZoneRects`, for a `scalePoint` x-axis instead of a `scaleLinear` y-axis.
 *
 * Bound resolution depends on `XZoneSpec.align` (see its JSDoc for the full `'center'`/`'edge'`
 * contract) — default `'center'` resolves a present key to the point's own center; `'edge'`
 * widens by half a step at each present bound so the band covers the terminal slots in full.
 *
 * A key that is not in the scale's domain skips that band entirely (renders nothing for it) —
 * it is NEVER clamped to a plot edge, in either mode. Clamping an unknown key would silently
 * paint a band across the whole chart for a typo'd or stale key, which is the exact class of
 * quiet lie the repo's "nothing to draw is two different states" doctrine rejects: an unknown key
 * must read as "not drawn", not as "the whole plot".
 *
 * A degenerate resolved range (right edge <= left edge, e.g. an inverted `from`/`to` pair) is
 * also skipped — no negative-width rect. In `'center'` mode `from === to` is degenerate (skipped,
 * today's behaviour); in `'edge'` mode it is NOT — the half-step widening on each side always
 * produces a positive-width, one-step-wide rect.
 */
export function XZoneRects({
  zones,
  height,
  xScale,
}: {
  zones: XZoneSpec[]
  /** Plot-area height (yMax); rects span from 0 to this. */
  height: number
  xScale: PointScale
}) {
  return (
    <>
      {zones.map((z, i) => {
        const [rangeStart, rangeEnd] = xScale.range() as [number, number]
        const rangeMin = Math.min(rangeStart, rangeEnd)
        const rangeMax = Math.max(rangeStart, rangeEnd)
        const align = z.align ?? 'center'
        const xFrom = resolveBound({
          key: z.from,
          omittedEdge: rangeStart,
          xScale,
          align,
          edgeSign: -1,
          rangeMin,
          rangeMax,
        })
        const xTo = resolveBound({
          key: z.to,
          omittedEdge: rangeEnd,
          xScale,
          align,
          edgeSign: 1,
          rangeMin,
          rangeMax,
        })
        if (xFrom === undefined || xTo === undefined) return null
        if (xTo <= xFrom) return null
        return (
          <rect
            key={`xzone-${i}`}
            x={xFrom}
            y={0}
            width={xTo - xFrom}
            height={height}
            fill={z.fill}
          />
        )
      })}
    </>
  )
}
