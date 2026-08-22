import type { ReactNode } from 'react'
import { alpha } from '../../tokens'

/**
 * A diagonal-hatch `<pattern>` — the one fill that reads as **absence** rather than as a weak
 * measurement.
 *
 * A faint solid tint cannot do this job: it sits on the same perceptual axis as every other
 * intensity of the same hue, so "nothing was measured here" and "everything measured here was
 * fine" collapse into neighbouring steps of one ramp. Hatching is off that axis entirely and
 * survives being placed beside a colour ramp of the same hue.
 *
 * `id` must be unique per document — `BandStrip` / `MirroredBars` namespace theirs with `chartId`.
 * `opacity` is applied through `alpha()` on the stroke rather than as an `opacity` attribute, so
 * the hue keeps resolving per colour scheme.
 */
export function HatchPattern({
  id,
  color,
  opacity = 0.55,
  size = 6,
}: {
  id: string
  color: string
  opacity?: number
  size?: number
}): ReactNode {
  return (
    <pattern
      id={id}
      width={size}
      height={size}
      patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)"
    >
      <line x1={0} y1={0} x2={0} y2={size} stroke={alpha(color, opacity)} strokeWidth={size / 3} />
    </pattern>
  )
}

/** `fill` value referencing a {@link HatchPattern} by id. */
export function hatchFill(id: string): string {
  return `url(#${id})`
}

/**
 * The pattern's own repeat, shrunk to fit the band it textures.
 *
 * Left at a fixed 6px a sub-pixel band draws less than one diagonal rule, so a fill/hatch split
 * inside one band antialiases into a single smudge no reader can tell from a fully-measured band.
 * Floored at 2 — below that the stroke has nothing to render on.
 */
export function hatchSizeFor(bandWidth: number): number {
  return Math.max(2, Math.min(6, Math.round(bandWidth)))
}
