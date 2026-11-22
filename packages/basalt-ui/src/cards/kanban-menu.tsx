/**
 * The popup half of a `KanbanCard`'s menu. It is the only file of `./cards` that imports
 * `ui/menu` (and so Base UI's menu), and `kanban-card` reaches it through `import()` alone, on the
 * first intent, so the card's initial graph stays inside its size ceiling (concept E6, S6).
 */
import { useState } from 'react'
import type { ReactElement, RefObject } from 'react'
import { AppLink } from '../core/link'
import type { NavTarget } from '../core/ports'
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

/** A menu row that is a link: the installed `LinkComponent` is the row's element. */
function LinkRow({ label, href }: { label: string; href: string | NavTarget }): ReactElement {
  return (
    // oxlint-disable-next-line jsx-a11y/control-has-associated-label -- MenuItem passes its children into the link
    <MenuItem render={<AppLink href={href} />}>{label}</MenuItem>
  )
}

const rowOf = (action: KanbanAction, close: (moved: boolean) => void): ReactElement =>
  'href' in action ? (
    <LinkRow key={action.key} label={action.label} href={action.href} />
  ) : (
    <MenuItem
      key={action.key}
      onClick={() => {
        close(!action.key.startsWith('x:'))
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
  // A move remounts the card in its new place, where the board gives it focus; returning focus to
  // this button, which the move unmounts, would drop it on the body.
  const [moved, setMoved] = useState(false)
  const close = (move: boolean): void => {
    setMoved(move)
    onOpenChange(false)
  }
  const change = (next: boolean): void => {
    if (next) setMoved(false)
    onOpenChange(next)
  }
  return (
    <Menu open={open} onOpenChange={change}>
      <MenuContent anchor={anchor} align="end" finalFocus={moved ? false : anchor}>
        {moves.map((a) => rowOf(a, close))}
        {moves.length > 0 && extras.length > 0 && <MenuSeparator />}
        {extras.map((a) => rowOf(a, close))}
      </MenuContent>
    </Menu>
  )
}
