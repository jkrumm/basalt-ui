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
 * @example
 * function MyChart() {
 *   const { ref, width, height } = useChartSize()
 *   return (
 *     <div ref={ref} style={{ width: '100%', height: 240 }}>
 *       {width > 0 && <Bars width={width} height={height} ... />}
 *     </div>
 *   )
 * }
 */
export function useChartSize(debounceMs = 0): UseChartSizeResult {
  const { parentRef, width, height } = useParentSize({ debounceTime: debounceMs })
  return { ref: parentRef, width, height }
}
