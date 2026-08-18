import { useParentSize } from '@visx/responsive'

export type ChartSize = {
  width: number
  height: number
}

export type UseChartSizeResult = ChartSize & {
  /** Attach to the container element to measure its dimensions. */
  ref: (node: HTMLDivElement | null) => void
}

/**
 * Measures the width and height of a container element via a ResizeObserver.
 * A thin basalt wrapper over `@visx/responsive`'s `useParentSize` — keeps the
 * `@visx/*` import inside `src/charts/**` per the Mantine-free boundary rule.
 *
 * Charts do not call this directly — `ChartFrame` (and `CartesianChart` above it) measure for
 * them, including the legend band. Reach for it when something OUTSIDE the chart system needs a
 * measured box, e.g. sizing a sparkline to its table cell.
 *
 * @example
 * function CellSparkline({ points }: { points: number[] }) {
 *   const { ref, width } = useChartSize()
 *   return (
 *     <div ref={ref} style={{ width: '100%', height: 24 }}>
 *       {width > 0 && <LineSparkline data={points} width={width} height={24} />}
 *     </div>
 *   )
 * }
 */
export function useChartSize(debounceMs = 0): UseChartSizeResult {
  const { parentRef, width, height } = useParentSize({ debounceTime: debounceMs })
  return { ref: parentRef, width, height }
}
