import type { ReactNode } from 'react'
import { VX } from '../../tokens'

/**
 * The shared vertical hover crosshair — one implementation for what used to be five hand-rolled
 * call sites (`MultiLine`, `ZonedLine`, `StackedArea`, `Bars`, `DualPanel`). `top`/`bottom` are the
 * plot-local y extent the line spans (usually `0` and the plot's `yMax`); `DualPanel` passes the
 * extent spanning both panes for its cross-pane crosshair.
 */
export function Crosshair({
  x,
  top,
  bottom,
}: {
  x: number
  top: number
  bottom: number
}): ReactNode {
  return <line x1={x} x2={x} y1={top} y2={bottom} stroke={VX.crosshair} strokeWidth={1} />
}

/**
 * The punched-out hover marker: a filled circle whose stroke is the chart background color, so it
 * reads as a "hole" cut into the line on both themes. Centralizes the `dotStroke = chart-bg` trick.
 */
export function SeriesDot({
  cx,
  cy,
  color,
  r,
}: {
  cx: number
  cy: number
  color: string
  r?: number
}): ReactNode {
  return (
    <circle cx={cx} cy={cy} r={r ?? VX.dotR} fill={color} stroke={VX.dotStroke} strokeWidth={2} />
  )
}
