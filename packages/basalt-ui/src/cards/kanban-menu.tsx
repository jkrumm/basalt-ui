/**
 * The popup half of a `KanbanCard`'s menu. It is the only file of `./cards` that imports
 * `ui/menu` (and so Base UI's menu), and `kanban-card` reaches it through `import()` alone, on the
 * first intent, so the card's initial graph stays inside its size ceiling (concept E6, S6).
 */
import type { ReactElement, RefObject } from 'react'
import { AppLink } from '../core/link'
import type { NavTarget } from '../core/ports'
import { Menu, MenuContent, MenuItem, MenuSeparator } from '../ui/menu'
import type { KanbanAction } from './kanban-actions'

export type KanbanMenuPopupProps = {
  /** The card's own menu button, or the point of a right click: the popup's anchor. */
  anchor: RefObject<HTMLButtonElement | null> | { getBoundingClientRect: () => DOMRect }
  /** The popup opened at a point, not from the button: it grows from the point and focus is not returned to the button. */
  pointer: boolean
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

const rowOf = (action: KanbanAction, close: () => void): ReactElement =>
  'href' in action ? (
    <LinkRow key={action.key} label={action.label} href={action.href} />
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
  pointer,
  open,
  onOpenChange,
  moves,
  extras,
}: KanbanMenuPopupProps): ReactElement {
  const close = (): void => onOpenChange(false)
  return (
    <Menu open={open} onOpenChange={onOpenChange}>
      <MenuContent
        anchor={anchor}
        align={pointer ? 'start' : 'end'}
        {...(!pointer && { finalFocus: anchor as RefObject<HTMLButtonElement | null> })}
      >
        {moves.map((a) => rowOf(a, close))}
        {moves.length > 0 && extras.length > 0 && <MenuSeparator />}
        {extras.map((a) => rowOf(a, close))}
      </MenuContent>
    </Menu>
  )
}
