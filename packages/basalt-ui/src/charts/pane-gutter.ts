/**
 * The y gutter the panes of one card share (`v3-expr-18-kit-fixes` 10, n91): each pane reports where its
 * plot starts, the card holds the widest, and a pane whose page set no `y.gutter` locks it as its left
 * margin, so the x ticks of every pane stand on one pixel column. A page's own `y.gutter` wins and
 * is neither read nor reported. Internal: no barrel exports it.
 */
import { createContext } from 'react'

export type PaneGutter = {
  /** The widest plot start reported so far, px; `undefined` until a pane has been laid out. */
  gutter: number | undefined
  /** A pane's plot start (its natural left margin, or the shared one it locked), px. */
  report: (left: number) => void
}

export const PaneGutterContext = createContext<PaneGutter | undefined>(undefined)
