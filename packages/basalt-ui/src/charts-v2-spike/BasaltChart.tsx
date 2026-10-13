import { Chart } from '@tanstack/charts/react'
import type { ChartDefinition } from '@tanstack/charts/react'
import type { CSSProperties } from 'react'

/** Server/first-paint width before the host measures (TanStack `initialWidth`). */
const INITIAL_WIDTH = 640

export type BasaltChartProps = {
  // oxlint-disable-next-line typescript/no-explicit-any -- spike: any definition the rung emits
  definition: ChartDefinition<any, any, any>
  ariaLabel: string
  height?: number
}

/**
 * The frame: the ONE place `@tanstack/charts/react` is imported. Owns `color` (so
 * `currentColor` is the axis ink), the font, `ariaLabel` (required) and the SSR width. The
 * `--ts-chart-*` vars are NOT set here — `chartEngineCss()` puts them on `:root`.
 */
export function BasaltChart({ definition, ariaLabel, height = 240 }: BasaltChartProps) {
  const style: CSSProperties = { color: 'var(--vx-axis)', fontFamily: 'inherit' }
  return (
    <Chart
      definition={definition}
      ariaLabel={ariaLabel}
      height={height}
      initialWidth={INITIAL_WIDTH}
      className="basalt-chart"
      style={style}
    />
  )
}
