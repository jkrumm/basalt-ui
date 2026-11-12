import type { Format } from '../format'
import type { BasaltMessages } from './index'

/**
 * The strings of `KanbanCard`: the two in-column moves, the move to another column, and the names
 * of the card's one menu button. The board's polite "moved" announcement is the recipe's own text
 * (app code cannot reach `useMessages`), so the catalog holds no `kanban.moved`.
 */
export type KanbanMessages = Record<'kanban.moveUp' | 'kanban.moveDown', string> &
  Record<'kanban.moveTo' | 'kanban.actions', (f: Format, name: string) => string> &
  Record<'kanban.actionFor', (f: Format, action: string, title: string) => string>

export const kanban = {
  'kanban.moveUp': 'Move up',
  'kanban.moveDown': 'Move down',
  'kanban.moveTo': (_f, column) => `Move to ${column}`,
  'kanban.actions': (_f, title) => `Actions for ${title}`,
  'kanban.actionFor': (_f, action, title) => `${action}: ${title}`,
} satisfies Partial<BasaltMessages>
