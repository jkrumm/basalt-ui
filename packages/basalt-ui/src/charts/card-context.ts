/**
 * The seam between a chart and its enclosing `ChartCard`: a chart whose legend is
 * `placement: 'header'` renders it at the top of its own body, styled as the card's header legend
 * row, when it knows it sits in a card. In the chart's own markup rather than handed to the header
 * from an effect, so the legend is in the server HTML and hydration grows nothing (W10).
 */
import { createContext, useContext } from 'react'

export const ChartCardContext = createContext(false)

export const useInChartCard = (): boolean => useContext(ChartCardContext)

const NONE: ReadonlySet<string> = new Set()

/**
 * The series keys a `ChartCard` legend has toggled off: a chart in the card's box hides them from
 * the plot, the tooltip and the scale, as its own legend toggle does.
 */
export const CardHiddenContext = createContext<ReadonlySet<string>>(NONE)

export const useCardHidden = (): ReadonlySet<string> => useContext(CardHiddenContext)
