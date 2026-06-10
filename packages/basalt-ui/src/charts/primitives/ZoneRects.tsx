import type { scaleLinear } from '@visx/scale'

/**
 * The linear-scale instance type, derived from `@visx/scale`'s own `scaleLinear` return type.
 * Equivalent to d3's `ScaleLinear<number, number>` but resolved through `@visx/scale` (an
 * installed dep) so it needs no `@types/d3-scale` and stays inside the visx-only-in-charts boundary.
 */
type LinearScale = ReturnType<typeof scaleLinear<number>>

export type ZoneSpec = {
  /** Lower bound on the anchored axis. Use -Infinity for "bottom of axis". */
  from: number
  /** Upper bound. Use Infinity for "top of axis". */
  to: number
  fill: string
  axisSide?: 'left' | 'right'
}

/**
 * Full-width horizontal zone backgrounds — one <rect> per zone, spanning
 * x=[0, width] and y=[scale(to), scale(from)]. Shared by every kind that
 * renders target-zone / threshold-zone bands.
 *
 * `Infinity` / `-Infinity` bounds clamp to the resolved domain of the
 * scale so "from: -Infinity" reads as "the bottom of this axis" regardless
 * of whether the domain is fixed or auto-computed.
 *
 * The wrapper picks left vs right scale per zone via `axisSide`; callers
 * on single-axis kinds just pass the same scale twice (or leave `rightScale`
 * undefined).
 */
export function ZoneRects({
  zones,
  width,
  leftScale,
  rightScale,
}: {
  zones: ZoneSpec[]
  /** Plot-area width (xMax); rects span from 0 to this. */
  width: number
  leftScale: LinearScale
  /** Required only when any zone has axisSide='right'. */
  rightScale?: LinearScale | null
}) {
  return (
    <>
      {zones.map((z, i) => {
        const scale = z.axisSide === 'right' && rightScale ? rightScale : leftScale
        const [domainMin, domainMax] = scale.domain() as [number, number]
        const zTo = z.to === Infinity ? domainMax : z.to
        const zFrom = z.from === -Infinity ? domainMin : z.from
        const yTop = scale(zTo)
        const yBottom = scale(zFrom)
        return (
          <rect
            key={`zone-${i}`}
            x={0}
            y={yTop}
            width={width}
            height={yBottom - yTop}
            fill={z.fill}
          />
        )
      })}
    </>
  )
}
