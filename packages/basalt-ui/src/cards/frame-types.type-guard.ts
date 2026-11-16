/**
 * Compile-time proof that every frame value type imports from `basalt-ui/cards` (wiring-3.2) and
 * that its `Tone` is the six-member port type, checked by `tsc --noEmit`.
 */
import type {
  Delta,
  Empty,
  FootFacts,
  FrameState,
  Menu,
  MenuEntry,
  Phase,
  QueryStateLike,
  Status,
  Tone,
} from './index'

export const tones: Record<'late' | 'open' | 'calm', Tone> = {
  late: 'info',
  open: 'accent',
  calm: 'neutral',
}

export const status: Status = { tone: 'info', label: 'Syncing' }
export const delta: Delta = { value: '+12%', polarity: 'up-good' }
export const empty: Empty = { cause: 'No runs yet' }
export const footer: FootFacts = [{ label: 'Open', value: 1 }, null]
export const entry: MenuEntry = { id: 'a', label: 'A', onClick: () => {} }
export const menu: Menu = [entry, { id: 'b', label: 'B', href: '/b' }]
export const query: QueryStateLike = { isPending: false, isError: false, error: null }
export const phase: Phase = query as unknown as Phase
export const frame: FrameState = { phase: query, empty }

// @ts-expect-error a tone outside the closed six is not a Tone
export const unknownTone: Tone = 'danger'
