import { createContext } from 'react'
import type { ResolvedPhase } from './phase'

/**
 * A frame that has no rows to show (a `DataPanel` in `empty` or `error`) tells the table inside its
 * body which arm to draw, so the table keeps its column header row and puts the arm inside itself
 * instead of the frame replacing the whole body. `claim` is how the table says it did: the frame
 * then drops its own arm, and a body that is no table keeps the frame's arm. Internal: no barrel
 * exports it.
 */
export type FrameArm = {
  arm: Extract<ResolvedPhase, { tag: 'empty' | 'error' }>
  /** The frame's body box height; the arm row fills what the head leaves of it. */
  height: number
  /** Marks the table as the arm's owner; the returned function releases it. */
  claim: () => () => void
}

export const FrameArmContext = createContext<FrameArm | undefined>(undefined)
