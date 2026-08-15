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
}

/**
 * Vertical zone backgrounds (x-range overlays — twilight bands, a shaded time window) — one
 * <rect> per zone, spanning y=[0, height] and x=[scale(from), scale(to)]. The x analog of
 * `ZoneRects`, for a `scalePoint` x-axis instead of a `scaleLinear` y-axis.
 *
 * An omitted `from` resolves to `0` (start of the plot area); an omitted `to` resolves to
 * `xScale.range()[1]` (the plot's right edge). A present key resolves to `xScale(key)` — the
 * POINT CENTER, so a band reads as "from this sample to that sample", not edge-to-edge.
 *
 * A key that is not in the scale's domain skips that band entirely (renders nothing for it) —
 * it is NEVER clamped to a plot edge. Clamping would silently paint a band across the whole
 * chart for a typo'd or stale key, which is the exact class of quiet lie the repo's "nothing to
 * draw is two different states" doctrine rejects: an unknown key must read as "not drawn", not
 * as "the whole plot".
 *
 * A degenerate resolved range (right edge <= left edge, e.g. an inverted `from`/`to` pair) is
 * also skipped — no negative-width rect.
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
        const xFrom = z.from === undefined ? rangeStart : xScale(z.from)
        const xTo = z.to === undefined ? rangeEnd : xScale(z.to)
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
