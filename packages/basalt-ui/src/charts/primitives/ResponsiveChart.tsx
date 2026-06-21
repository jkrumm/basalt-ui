import type { ReactNode } from 'react'
import { useChartSize } from '../hooks/useChartSize'

export type ResponsiveChartProps = {
  /**
   * Fixed height in pixels. Used when `aspectRatio` is not set. Default 240.
   * Ignored when `aspectRatio` is set — height is derived from measured width.
   */
  height?: number
  /**
   * When set, height = Math.round(width / aspectRatio) and `height` prop is ignored.
   * E.g. `aspectRatio={16 / 9}` produces a 16:9 panel.
   */
  aspectRatio?: number
  /** ResizeObserver debounce in milliseconds. Default 0 (immediate). */
  debounceMs?: number
  /** Render prop — called with the measured `{ width, height }`. */
  children: (size: { width: number; height: number }) => ReactNode
}

/**
 * Render-prop container that measures its own width and derives a final height
 * from `height` (default 240) or `aspectRatio`. Renders nothing until the first
 * measurement arrives (`width > 0`). Backed by `@visx/responsive`'s `useParentSize`.
 *
 * @example
 * <ResponsiveChart height={320}>
 *   {({ width, height }) => (
 *     <Bars width={width} height={height} data={data} ... />
 *   )}
 * </ResponsiveChart>
 *
 * @example aspectRatio
 * <ResponsiveChart aspectRatio={16 / 9}>
 *   {({ width, height }) => <MyChart width={width} height={height} />}
 * </ResponsiveChart>
 */
export function ResponsiveChart({
  height = 240,
  aspectRatio,
  debounceMs = 0,
  children,
}: ResponsiveChartProps): ReactNode {
  const { ref, width } = useChartSize(debounceMs)

  const resolvedHeight = aspectRatio !== undefined ? Math.round(width / aspectRatio) : height

  return (
    <div ref={ref} style={{ width: '100%' }}>
      {width > 0 ? children({ width, height: resolvedHeight }) : null}
    </div>
  )
}
