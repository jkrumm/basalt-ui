/**
 * The header's one kebab: the global actions the row has no room for, listed in declaration order
 * so nothing is ever lost (concept section 1 row "Header", spike S6).
 *
 * Which actions yield is decided by CSS (`header.tsx` tiers on the header container), so the server
 * markup is right at every width. The kebab therefore reads the DOM when it opens: an action whose
 * wrapper is `display: none` at that moment is the one that yielded, and it appears here.
 */
import { useState } from 'react'
import type { ReactElement, RefObject } from 'react'
import { Button } from '../../ui/button'
import { Menu, MenuContent, MenuItem, MenuSub, MenuTrigger } from '../../ui/menu'
import type { GlobalAction, ShellBox, SizeClass } from '../contract'
import { headerPriority } from '../core/header-tiers'

/** Which tiers have an item, so the kebab shows from the width where its first item yields. */
export function kebabTiers(actions: readonly GlobalAction[]): {
  p2: boolean
  p3: boolean
  /** Whether a yielding action is one the phone bar keeps, so the kebab has a row there. */
  phone: boolean
} {
  const priorities = actions.map((action) => headerPriority(action.priority))
  const phone = actions.some(
    (action) =>
      headerPriority(action.priority) > 1 && action.mobile !== 'more' && action.mobile !== 'hidden',
  )
  return { p2: priorities.includes(2), p3: priorities.includes(3), phone }
}

/** Text for a yielded action: the label, with its count when a popover action carries one. */
function actionLabel(action: GlobalAction): string {
  if (action.kind !== 'popover') return action.label
  const count = action.badge ?? 0
  return count > 0 ? `${action.label} (${count})` : action.label
}

function KebabRow({ action, box }: { action: GlobalAction; box: ShellBox }): ReactElement {
  if (action.kind === 'button') {
    const Icon = action.icon
    return (
      <MenuItem onClick={action.onClick}>
        <Icon className="size-icon" aria-hidden />
        {action.label}
      </MenuItem>
    )
  }
  if (action.kind === 'popover') {
    return <MenuSub label={actionLabel(action)}>{action.content(box)}</MenuSub>
  }
  return (
    <div
      data-slot="shell-kebab-custom"
      className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground"
    >
      {action.render(box)}
    </div>
  )
}

export type HeaderKebabProps = {
  actions: readonly GlobalAction[]
  sizeClass: SizeClass
  /** The header row that holds the tier-hidden wrappers (`[data-item]`). */
  rowRef: RefObject<HTMLElement | null>
  /** What a `custom` or `popover` action receives: the same box as in the row. */
  box: ShellBox
  /** The wrapper's tier visibility (`kebabTiers` decides which widths show it). */
  className: string
}

export function HeaderKebab({
  actions,
  sizeClass,
  rowRef,
  box,
  className,
}: HeaderKebabProps): ReactElement {
  const [yielded, setYielded] = useState<readonly string[]>([])

  const read = (open: boolean): void => {
    if (!open) return
    const nodes = rowRef.current?.querySelectorAll<HTMLElement>('[data-item]') ?? []
    const hidden = [...nodes].filter((node) => {
      if (getComputedStyle(node).display !== 'none') return false
      // Phone-only omissions belong to the tab bar's More, not to this menu.
      return !(sizeClass === 'compact' && node.dataset['phoneOff'] !== undefined)
    })
    setYielded(hidden.map((node) => node.dataset['item'] ?? ''))
  }

  const rows = yielded.flatMap((id) => {
    const action = actions.find((candidate) => candidate.id === id)
    return action === undefined ? [] : [action]
  })

  return (
    <span data-slot="shell-kebab" className={className}>
      <Menu onOpenChange={read}>
        <MenuTrigger render={<Button variant="ghost" size="icon" aria-label="More actions" />}>
          <svg viewBox="0 0 16 16" className="size-icon" fill="currentColor" aria-hidden="true">
            <circle cx="3" cy="8" r="1.25" />
            <circle cx="8" cy="8" r="1.25" />
            <circle cx="13" cy="8" r="1.25" />
          </svg>
        </MenuTrigger>
        <MenuContent align="end">
          {rows.map((action) => (
            <KebabRow key={action.id} action={action} box={box} />
          ))}
        </MenuContent>
      </Menu>
    </span>
  )
}
