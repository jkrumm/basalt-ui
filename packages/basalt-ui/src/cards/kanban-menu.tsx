/**
 * The popup half of a `KanbanCard`'s menu. It is the only file of `./cards` that imports
 * `ui/menu` (and so Base UI's menu), and `kanban-card` reaches it through `import()` alone, on the
 * first intent, so the card's initial graph stays inside its size ceiling (concept E6, S6).
 */
import type { ReactElement, RefObject } from 'react'
import { Menu, MenuContent, MenuItem, MenuSeparator } from '../ui/menu'
import type { KanbanAction } from './kanban-actions'

export type KanbanMenuPopupProps = {
  /** The card's own menu button: the popup's anchor, and where focus returns on close. */
  anchor: RefObject<HTMLButtonElement | null>
  open: boolean
  onOpenChange: (open: boolean) => void
  moves: readonly KanbanAction[]
  extras: readonly KanbanAction[]
}

const rowOf = (action: KanbanAction, close: () => void): ReactElement =>
  'href' in action ? (
    // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- MenuItem passes its children into the link
    <MenuItem key={action.key} render={<a href={action.href} />}>
      {action.label}
    </MenuItem>
  ) : (
    <MenuItem
      key={action.key}
      onClick={() => {
        close()
        action.run()
      }}
    >
      {action.label}
    </MenuItem>
  )

export function KanbanMenuPopup({
  anchor,
  open,
  onOpenChange,
  moves,
  extras,
}: KanbanMenuPopupProps): ReactElement {
  const close = (): void => onOpenChange(false)
  return (
    <Menu open={open} onOpenChange={onOpenChange}>
      <MenuContent anchor={anchor} align="end" finalFocus={anchor}>
        {moves.map((a) => rowOf(a, close))}
        {moves.length > 0 && extras.length > 0 && <MenuSeparator />}
        {extras.map((a) => rowOf(a, close))}
      </MenuContent>
    </Menu>
  )
}
