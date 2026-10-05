import type { FocusEventHandler, KeyboardEventHandler, PointerEventHandler } from 'react'
import type { ChartCursor } from '../hooks/useChartCursor'
import styles from './HoverOverlay.module.css'

/** Props of {@link HoverOverlay}. */
export type HoverOverlayProps = {
  width: number
  height: number
  onMove: PointerEventHandler<SVGRectElement>
  /** Coarse-pointer tap: resolves + shows the tooltip immediately, with no preceding `pointermove`
   * (`docs/CHARTS-SPEC.md` §4, Tooltip). The press is provisional; `onUp` commits it. */
  onDown?: PointerEventHandler<SVGRectElement>
  /** Commits the provisional touch press so the pin survives the lift. */
  onUp?: PointerEventHandler<SVGRectElement>
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
}

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
  onDown,
  onUp,
  onLeave,
  onKeyDown,
  onBlur,
  ariaLabel,
  valueNow,
  valueMax,
  valueText,
}: HoverOverlayProps) {
  return (
    // `touch-action: pan-y` lives on the plot's `<svg>` (each kind's own), NOT here: Chrome ignores
    // `touch-action` on an SVG child `<rect>`, so the browser claims a horizontal pan and cancels
    // the pointer (`R2C-2`). The `overlay` class owns the focus ring: no UA outline on tap, a VX
    // accent inset under `:focus-visible` (`R2C-15`).
    <rect
      className={styles.overlay}
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
        // `aria-valuenow` is required on a slider: 0 (the first point) until the cursor lands on one.
        'aria-valuenow': valueNow ?? 0,
        ...(valueText !== undefined && { 'aria-valuetext': valueText }),
        onKeyDown,
        ...(onBlur !== undefined && { onBlur }),
      })}
      onPointerMove={onMove}
      {...(onDown !== undefined && { onPointerDown: onDown })}
      {...(onUp !== undefined && { onPointerUp: onUp })}
      onPointerLeave={onLeave}
      onPointerCancel={onLeave}
    />
  )
}

/**
 * Everything a FOCUSABLE overlay over indexed data takes besides its rect: the cursor's pointer and
 * keyboard handlers plus the slider label/position. `CartesianChart`, `DualPanel`'s top pane and
 * the banded kinds all wire it identically, so it is stated once.
 */
export function cursorSliderProps<T>(input: {
  cursor: ChartCursor<T>
  data: readonly T[]
  getX: (d: T) => string
  formatX: (key: string) => string
  ariaLabel: string | undefined
}): Omit<HoverOverlayProps, 'width' | 'height'> {
  const { cursor, data, getX, formatX, ariaLabel } = input
  const { point } = cursor
  return {
    onMove: cursor.onPointerMove,
    onDown: cursor.onPointerDown,
    onUp: cursor.onPointerUp,
    onLeave: cursor.onPointerLeave,
    onKeyDown: cursor.onKeyDown,
    onBlur: cursor.onBlur,
    valueMax: Math.max(data.length - 1, 0),
    ...(point !== null && { valueNow: data.indexOf(point), valueText: formatX(getX(point)) }),
    ...(ariaLabel !== undefined && { ariaLabel }),
  }
}
