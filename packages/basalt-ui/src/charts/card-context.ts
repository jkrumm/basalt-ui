/**
 * The seam between a chart and its enclosing `ChartCard`: a chart whose legend is
 * `placement: 'header'` renders it at the top of its own body, styled as the card's header legend
 * row, when it knows it sits in a card. In the chart's own markup rather than handed to the header
 * from an effect, so the legend is in the server HTML and hydration grows nothing (W10).
 */
import { createContext, useContext } from 'react'

export const ChartCardContext = createContext(false)

export const useInChartCard = (): boolean => useContext(ChartCardContext)
