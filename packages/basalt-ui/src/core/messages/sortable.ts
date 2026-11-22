import type { Format } from '../format'
import type { BasaltMessages } from './index'

/** The strings of `SortableList`: the handle's name and hint, and the polite "moved" announcement. */
export type SortableMessages = Record<'sortable.hint', string> &
  Record<'sortable.handle', (f: Format, name: string) => string> &
  Record<'sortable.moved', (f: Format, name: string, position: number, of: number) => string>

export const sortable = {
  'sortable.handle': (_f, name) => `Reorder ${name}`,
  'sortable.hint': 'Drag, or press the up and down arrow keys to move',
  'sortable.moved': (_f, name, position, of) => `${name} moved to position ${position} of ${of}`,
} satisfies Partial<BasaltMessages>
