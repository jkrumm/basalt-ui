import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings of `KanbanCard` and `Board`: the two in-column moves, the move to another column,
 * the names of the card's one menu button, the board's polite "moved" announcement and the empty
 * column's placeholder.
 */
export type KanbanMessages = Record<'kanban.moveUp' | 'kanban.moveDown' | 'kanban.empty', string> &
  Record<'kanban.moveTo' | 'kanban.actions', (f: Format, name: string) => string> &
  Record<'kanban.actionFor', (f: Format, action: string, title: string) => string> &
  Record<
    'kanban.moved',
    (f: Format, title: string, column: string, position: number, of: number) => string
  >

export const kanban = {
  'kanban.moveUp': 'Move up',
  'kanban.moveDown': 'Move down',
  'kanban.moveTo': (_f, column) => `Move to ${column}`,
  'kanban.actions': (_f, title) => `Actions for ${title}`,
  'kanban.actionFor': (_f, action, title) => `${action}: ${title}`,
  'kanban.moved': (_f, title, column, position, of) =>
    `${title} moved to ${column}, position ${position} of ${of}`,
  'kanban.empty': 'No cards',
} satisfies Partial<BasaltMessages>
