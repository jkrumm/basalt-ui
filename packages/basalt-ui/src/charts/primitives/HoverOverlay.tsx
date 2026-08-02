import type { PointerEventHandler } from 'react'

/** Transparent <rect> that captures pointer events (mouse + touch + pen) for tooltip + crosshair
 * sync. */
export function HoverOverlay({
  width,
  height,
  onMove,
  onLeave,
}: {
  width: number
  height: number
  onMove: PointerEventHandler<SVGRectElement>
  onLeave: PointerEventHandler<SVGRectElement>
}) {
  return (
    <rect
      width={width}
      height={height}
      fill="transparent"
      // `pan-y`, not `none`: `none` would turn a full-width chart into a scroll dead zone on a
      // phone. `pan-y` lets vertical page scroll pass through while a horizontal drag still
      // reaches this overlay to scrub the chart.
      style={{ touchAction: 'pan-y' }}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onPointerCancel={onLeave}
    />
  )
}
