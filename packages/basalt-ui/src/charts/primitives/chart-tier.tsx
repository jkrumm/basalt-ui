import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { chartTierMetrics, resolveChartTier } from './chart-frame-layout'
import type { ChartTier, ChartTierMetrics } from './chart-frame-layout'

/**
 * Ambient chart tier. `ChartFrame` publishes the tier it resolved from its own MEASURED width;
 * the axes, the legend, the crosshair dots and the tooltip read it back without every kind having
 * to thread a prop it does not otherwise care about.
 *
 * Default `'desktop'`, so a primitive rendered outside a `ChartFrame` (a hand-composed plot, a
 * `TooltipRow` in a consumer's own tooltip) keeps exactly today's sizes.
 */
const ChartTierContext = createContext<ChartTier>('desktop')

export type ChartTierProviderProps = {
  tier: ChartTier
  children: ReactNode
}

/** Publishes a resolved tier to the subtree. Mounted once, by `ChartFrame`. */
export function ChartTierProvider({ tier, children }: ChartTierProviderProps): ReactNode {
  return <ChartTierContext.Provider value={tier}>{children}</ChartTierContext.Provider>
}

/** The tier of the nearest measured `ChartFrame`, or `'desktop'` outside one. */
export function useChartTier(): ChartTier {
  return useContext(ChartTierContext)
}

/** The resolved sizes for the ambient tier — the form every primitive actually wants. */
export function useChartTierMetrics(): ChartTierMetrics {
  return chartTierMetrics(useContext(ChartTierContext))
}

export { chartTierMetrics, resolveChartTier }
export type { ChartTier, ChartTierMetrics }
