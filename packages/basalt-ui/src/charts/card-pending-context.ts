/**
 * Set by a pending `ChartCard` around a body it renders as-is (`placeholderHeight="content"`): a
 * `BarList`, `EventList` or `Meter` in that body reads it and draws its own loading skeleton, so a
 * loading card never shows its real figure. Internal and Mantine-free: never exported.
 */
import { createContext, useContext } from 'react'

export const CardPendingContext = createContext(false)

export const useCardPending = (): boolean => useContext(CardPendingContext)
