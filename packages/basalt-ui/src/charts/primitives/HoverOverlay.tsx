import type { FocusEventHandler, KeyboardEventHandler, PointerEventHandler } from 'react'

/**
 * Transparent <rect> that captures pointer events (mouse + touch + pen) for tooltip + crosshair
 * sync.
 *
 * With `onKeyDown` it also becomes the chart's keyboard affordance: the rect takes focus and
 * ←/→ scrub the cursor, so a chart's values are reachable without a pointer.
 */
export function HoverOverlay({
  width,
  height,
  onMove,
  onLeave,
  onKeyDown,
  onBlur,
  ariaLabel,
  valueNow,
  valueMax,
  valueText,
}: {
  width: number
  height: number
  onMove: PointerEventHandler<SVGRectElement>
  onLeave: PointerEventHandler<SVGRectElement>
  /** Present = the overlay is focusable and scrubs on ←/→. */
  onKeyDown?: KeyboardEventHandler<SVGRectElement>
  onBlur?: FocusEventHandler<SVGRectElement>
  ariaLabel?: string
  /** Index of the focused point — announced as the slider position. */
  valueNow?: number
  /** Last index of the domain. */
  valueMax?: number
  /** Human-readable label for the focused point (the formatted x key). */
  valueText?: string
}) {
  return (
    <rect
      width={width}
      height={height}
      fill="transparent"
      {...(onKeyDown !== undefined && {
        tabIndex: 0,
        // `slider`, not `application`: `application` would drop this node out of the screen
        // reader's normal browse mode entirely, which is a far bigger hammer than an arrow-key
        // scrub needs. A slider announces both the affordance and the focused point.
        role: 'slider',
        'aria-label': ariaLabel ?? 'Chart data — use arrow keys to scrub',
        'aria-orientation': 'horizontal' as const,
        'aria-valuemin': 0,
        ...(valueMax !== undefined && { 'aria-valuemax': valueMax }),
        ...(valueNow !== undefined && { 'aria-valuenow': valueNow }),
        ...(valueText !== undefined && { 'aria-valuetext': valueText }),
        onKeyDown,
        ...(onBlur !== undefined && { onBlur }),
      })}
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
