import type { Translate } from '../core/messages/use-messages'
import type { kanban } from '../core/messages/kanban'
import type { KanbanCardProps, MenuAction, Move } from './contract'

/** One row of the card's menu: a link or a handler, never both. `key` is stable per row. */
export type KanbanAction = { key: string; label: string } & ({ href: string } | { run: () => void })

type MoveSpec<C extends string> = Exclude<KanbanCardProps<C>['move'], 'static'>

/**
 * The ordered actions of one card: Move up and Move down where the index allows, one move per
 * other (enabled) column appending at its `count`, then the consumer's own `menu` entries. Every
 * move goes through `onMove` with the same `Move` a drop would produce.
 */
export function kanbanActions<C extends string>(
  id: string,
  move: MoveSpec<C> | 'static',
  menu: readonly MenuAction[] | undefined,
  t: Translate<typeof kanban>,
): { moves: KanbanAction[]; extras: KanbanAction[] } {
  const moves: KanbanAction[] = []
  if (move !== 'static') {
    const { column, index, columns, onMove } = move
    const send = (to: C, at: number): (() => void) => {
      return () => onMove({ id, from: column.id, to, index: at } satisfies Move<C>)
    }
    if (index > 0)
      moves.push({ key: 'up', label: t('kanban.moveUp'), run: send(column.id, index - 1) })
    if (index < column.count - 1)
      moves.push({ key: 'down', label: t('kanban.moveDown'), run: send(column.id, index + 1) })
    for (const other of columns) {
      if (other.id === column.id || other.disabled === true) continue
      moves.push({
        key: `to:${other.id}`,
        label: t('kanban.moveTo', other.label),
        run: send(other.id, other.count),
      })
    }
  }
  const extras = (menu ?? []).map((a): KanbanAction =>
    'href' in a
      ? { key: `x:${a.label}`, label: a.label, href: a.href }
      : { key: `x:${a.label}`, label: a.label, run: a.onSelect },
  )
  return { moves, extras }
}
