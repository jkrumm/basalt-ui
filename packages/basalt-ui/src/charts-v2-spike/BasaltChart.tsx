import { Chart } from '@tanstack/charts/react'
import type { ChartDefinition } from '@tanstack/charts/react'
import type { CSSProperties } from 'react'
import { CHART_HOST_VARS } from './theme-bridge'

/** Server/first-paint width before the host measures (TanStack `initialWidth`). */
const INITIAL_WIDTH = 640

export type BasaltChartProps = {
  // oxlint-disable-next-line typescript/no-explicit-any -- spike: any definition the rung emits
  definition: ChartDefinition<any, any, any>
  ariaLabel: string
  height?: number
}

/**
 * The frame: the ONE place `@tanstack/charts/react` is imported. Owns the host vars (theme
 * bridge), `color` (so `currentColor` is the axis ink), the font, `ariaLabel` (required) and the
 * SSR width. Everything inside the plot is the definition's.
 */
export function BasaltChart({ definition, ariaLabel, height = 240 }: BasaltChartProps) {
  const style = {
    ...CHART_HOST_VARS,
    color: 'var(--vx-axis)',
    fontFamily: 'inherit',
  } as CSSProperties
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
