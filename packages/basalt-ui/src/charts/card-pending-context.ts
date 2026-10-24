/**
 * Set by a pending `ChartCard` around a body it renders as-is (`placeholderHeight="content"`): a
 * `BarList`, `EventList` or `Meter` in that body reads it and draws its own loading skeleton, so a
 * loading card never shows its real figure. Internal (not in the package's public exports) and Mantine-free.
 */
import { createContext, useContext } from 'react'

export const CardPendingContext = createContext(false)

export const useCardPending = (): boolean => useContext(CardPendingContext)

const FIGURE_BODY = Symbol.for('basalt-ui.figure-body')

/**
 * Marks a component as a lone figure (`BarList`, `EventList`, `Meter`): a `ChartCard` whose body is
 * one loads, empties and errors in the figure's own shape with no `placeholderHeight`. A static
 * marker, so `src/charts` learns the kind without importing `src/dashboard`.
 */
export const markFigureBody = <T extends object>(component: T): T =>
  Object.assign(component, { [FIGURE_BODY]: true })

export const isFigureBody = (type: unknown): boolean =>
  (typeof type === 'function' || (typeof type === 'object' && type !== null)) &&
  (type as { [FIGURE_BODY]?: unknown })[FIGURE_BODY] === true
