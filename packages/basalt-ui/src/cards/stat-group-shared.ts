import { createContext } from 'react'
import { cards } from '../core/messages/cards'
import { useMessages } from '../core/messages/use-messages'

/** Which layout the surrounding `StatGroup` draws; `null` outside a group (a lone `StatCell`). */
export type StatGroupVariant = 'strip' | 'cards'

export const StatGroupContext = createContext<StatGroupVariant | null>(null)

/** How many frames (`DataPanel`, `StatGroup`) enclose the reader. */
export const FrameDepthContext = createContext(0)

/** The name of a card's definition glyph (`About Shipped`); the one place that reads `cards.about`. */
export function useAboutLabel(): (title: string) => string {
  const t = useMessages(cards)
  return (title) => t('cards.about', title)
}

/** Controls that fit in a header before it stops being a header. */
export const MAX_INLINE_CONTROLS = 2
/** Rows a `StatCell` draws; more belong in a list or a table. */
export const MAX_ROWS = 4
/** Frames inside frames; a third level is a page layout problem, not a card. */
export const MAX_DEPTH = 2

const warned = new Set<string>()

/**
 * Dev only: says once per page load, per key, that a card broke a density rule. The gate is the
 * literal `process.env.NODE_ENV` read, so a bundler folds the whole body away in production.
 */
export function warnOnce(key: 'controls' | 'rows' | 'depth', message: string): void {
  if (process.env.NODE_ENV === 'production' || warned.has(key)) return
  warned.add(key)
  console.warn(message)
}

/** Test seam: forget that the warnings ran. */
export function resetCardWarnings(): void {
  warned.clear()
}
