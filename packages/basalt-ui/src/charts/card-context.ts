/**
 * The seam between a chart and its enclosing `ChartCard`: a chart whose legend is
 * `placement: 'header'` hands the card its legend node; the card renders it in the header row. A
 * node, not a portal — `src/charts/**` reaches no `react-dom`.
 */
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

export type ChartCardContextValue = {
  /** Claim (or, with `null`, release) the header legend slot for `owner` (a chart's `useId`). */
  setHeaderLegend: (owner: string, node: ReactNode | null) => void
}

export const ChartCardContext = createContext<ChartCardContextValue | null>(null)

export const useChartCard = (): ChartCardContextValue | null => useContext(ChartCardContext)
