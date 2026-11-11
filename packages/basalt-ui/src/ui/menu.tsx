import { Menu as BaseMenu } from '@base-ui/react/menu'
import { cva } from 'class-variance-authority'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'

/**
 * The `MenuContent` cva table: the popup of a list of actions, at least 10 rem wide and never taller
 * than the room the browser leaves (`--available-height`), so a long menu scrolls inside it. It
 * grows from the trigger.
 *
 * @example
 * menuContentVariants() // class string for a hand-built popup
 */
export const menuContentVariants = cva(
  'max-h-(--available-height) min-w-40 origin-(--transform-origin) overflow-y-auto rounded-ctrl border border-border bg-popover p-1 text-sm text-popover-foreground shadow-overlay outline-none transition-[opacity,scale] duration-150 ease-standard data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0 motion-reduce:transition-none',
)

/**
 * The `MenuItem` cva table: one row, shared by the plain, checkbox, radio and submenu items. The
 * highlighted row (keyboard or pointer) is filled; a coarse pointer lifts it to the 44 px floor.
 *
 * @example
 * menuItemVariants()
 */
export const menuItemVariants = cva(
  'relative flex w-full cursor-default items-center justify-between gap-2 rounded-chip px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-popup-open:bg-accent data-disabled:pointer-events-none data-disabled:opacity-50 pointer-coarse:min-h-11 pointer-coarse:text-base',
)

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const menuParts = [
  'menu-trigger',
  'menu-content',
  'menu-item',
  'menu-group',
  'menu-checkbox-item',
  'menu-radio-group',
  'menu-radio-item',
  'menu-sub',
  'menu-separator',
] as const

type Layout<P> = Omit<P, 'className'> & {
  /** Layout only (`w-full`, `mt-2`). Display, height and stacking belong to the part. */
  className?: string
}

/** Where the popup sits against its anchor. Collisions flip it; the popup never leaves the screen. */
export type MenuPlacement = Pick<
  BaseMenu.Positioner.Props,
  'anchor' | 'side' | 'align' | 'sideOffset' | 'alignOffset'
>

export type MenuProps = BaseMenu.Root.Props
export type MenuTriggerProps = Layout<BaseMenu.Trigger.Props>
export type MenuContentProps = Layout<Omit<BaseMenu.Popup.Props, 'ref'>> &
  MenuPlacement & {
    /** Where the popup renders. Default `document.body`. */
    container?: BaseMenu.Portal.Props['container']
  }
export type MenuItemProps = Layout<BaseMenu.Item.Props>
export type MenuGroupProps = Layout<BaseMenu.Group.Props> & {
  /** The group heading; it names the group for assistive tech. */
  label: ReactNode
}
export type MenuCheckboxItemProps = Layout<BaseMenu.CheckboxItem.Props>
export type MenuRadioGroupProps = Layout<BaseMenu.RadioGroup.Props>
export type MenuRadioItemProps = Layout<BaseMenu.RadioItem.Props>
export type MenuSubProps = Layout<Omit<BaseMenu.SubmenuTrigger.Props, 'children' | 'label'>> &
  Pick<MenuPlacement, 'sideOffset' | 'alignOffset'> & {
    /** The row that opens the submenu. Also the typeahead text, so keep it short. */
    label: string
    /** The submenu's items. */
    children: ReactNode
  }
export type MenuSeparatorProps = Layout<BaseMenu.Separator.Props>

/**
 * A menu with an `anchor` has no trigger to hand focus to its list, and Base UI focuses the popup
 * itself for a pointer open. Move focus onto the first enabled row once the popup is on screen, the
 * way a keyboard open does.
 */
function focusFirstItem(popup: HTMLElement | null): void {
  if (popup === null) return
  requestAnimationFrame(() => {
    popup.querySelector<HTMLElement>('[role^="menuitem"]:not([data-disabled])')?.focus()
  })
}

function Glyph({ d, className }: { d: string; className?: string }): ReactElement {
  return (
    <svg viewBox="0 0 16 16" className={cn('size-icon', className)} fill="none" aria-hidden="true">
      <path
        d={d}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * A list of actions on Base UI: Enter, Space or a click opens it, arrows and typeahead move,
 * Enter or a click runs an item, Escape closes it and gives focus back, and it is always portalled
 * above the page. Open state stays with the caller (`open`/`onOpenChange`) or the trigger. Works
 * with no provider.
 *
 * A pointer-anchored menu (a right click, a registry command) needs no trigger: control `open` and
 * pass `MenuContent anchor` an element or a virtual `{ getBoundingClientRect }`.
 *
 * Which job, which part: a list of actions, `Menu`; one value of a few, `Select`; any other panel,
 * `Popover`; a one-line hint, `Tooltip`; a modal decision, `Dialog`.
 *
 * @useWhen a trigger or a point on the page opens a list of actions, toggles or one-of-many choices
 * @neverWhen the list picks a form value (use `Select`) or holds arbitrary content (use `Popover`)
 *
 * @example
 * <Menu>
 *   <MenuTrigger render={<Button />}>Actions</MenuTrigger>
 *   <MenuContent>
 *     <MenuItem onClick={rename}>Rename</MenuItem>
 *     <MenuSeparator />
 *     <MenuItem onClick={remove}>Delete</MenuItem>
 *   </MenuContent>
 * </Menu>
 */
export function Menu(props: MenuProps): ReactElement {
  return <BaseMenu.Root {...props} />
}

/**
 * The element that opens a `Menu`. It carries no look of its own: pass `render={<Button />}`.
 *
 * @example
 * <MenuTrigger render={<Button />}>Actions</MenuTrigger>
 */
export function MenuTrigger({ className, ...props }: MenuTriggerProps): ReactElement {
  return (
    <BaseMenu.Trigger {...props} data-slot="menu-trigger" className={cn('focus-ring', className)} />
  )
}

/**
 * The popup, portalled and positioned by Base UI. `anchor` takes an element or a virtual rect when
 * the menu has no trigger, and then focus lands on the first item. `finalFocus` names where focus
 * goes when it closes (a ref, an element, or `false` to leave it); the default is the trigger, or
 * the element that held focus before.
 *
 * @example
 * <MenuContent anchor={{ getBoundingClientRect: () => rectAt(x, y) }}>...</MenuContent>
 */
export function MenuContent({
  anchor,
  side,
  align,
  sideOffset = 4,
  alignOffset,
  container,
  className,
  children,
  ...props
}: MenuContentProps): ReactElement {
  return (
    <BaseMenu.Portal {...(container !== undefined && { container })}>
      <BaseMenu.Positioner
        {...(anchor !== undefined && { anchor })}
        {...(side !== undefined && { side })}
        {...(align !== undefined && { align })}
        {...(alignOffset !== undefined && { alignOffset })}
        sideOffset={sideOffset}
        className="z-50 outline-none"
      >
        <BaseMenu.Popup
          {...props}
          {...(anchor !== undefined && { ref: focusFirstItem })}
          data-slot="menu-content"
          className={cn(menuContentVariants(), className)}
        >
          {children}
        </BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  )
}

/**
 * One action. `onClick` runs it and the menu closes; `closeOnClick={false}` keeps the menu open.
 *
 * @example
 * <MenuItem onClick={rename}>Rename</MenuItem>
 */
export function MenuItem({ className, ...props }: MenuItemProps): ReactElement {
  return (
    <BaseMenu.Item {...props} data-slot="menu-item" className={cn(menuItemVariants(), className)} />
  )
}

/**
 * A labelled run of items.
 *
 * @example
 * <MenuGroup label="Move to"><MenuItem>Inbox</MenuItem></MenuGroup>
 */
export function MenuGroup({ className, label, children, ...props }: MenuGroupProps): ReactElement {
  return (
    <BaseMenu.Group {...props} data-slot="menu-group" className={className}>
      <BaseMenu.GroupLabel className="px-2 py-1.5 text-xs text-muted-foreground">
        {label}
      </BaseMenu.GroupLabel>
      {children}
    </BaseMenu.Group>
  )
}

/**
 * A toggle: it carries a check while `checked`. It keeps the menu open by default so several can be
 * flipped in one visit; `closeOnClick` closes it.
 *
 * @example
 * <MenuCheckboxItem checked={grid} onCheckedChange={setGrid}>Show grid</MenuCheckboxItem>
 */
export function MenuCheckboxItem({
  className,
  children,
  closeOnClick = false,
  ...props
}: MenuCheckboxItemProps): ReactElement {
  return (
    <BaseMenu.CheckboxItem
      {...props}
      closeOnClick={closeOnClick}
      data-slot="menu-checkbox-item"
      className={cn(menuItemVariants(), className)}
    >
      {children}
      <BaseMenu.CheckboxItemIndicator>
        <Glyph d="M3.5 8.5l3 3 6-7" />
      </BaseMenu.CheckboxItemIndicator>
    </BaseMenu.CheckboxItem>
  )
}

/**
 * The group of `MenuRadioItem`s that share one value (`value`/`onValueChange`).
 *
 * @example
 * <MenuRadioGroup value={sort} onValueChange={setSort}><MenuRadioItem value="name">Name</MenuRadioItem></MenuRadioGroup>
 */
export function MenuRadioGroup({ className, ...props }: MenuRadioGroupProps): ReactElement {
  return <BaseMenu.RadioGroup {...props} data-slot="menu-radio-group" className={className} />
}

/**
 * One choice of a `MenuRadioGroup`; the chosen one carries a dot. It closes the menu on click by
 * default (`closeOnClick={false}` keeps it open).
 *
 * @example
 * <MenuRadioItem value="name">Name</MenuRadioItem>
 */
export function MenuRadioItem({ className, children, ...props }: MenuRadioItemProps): ReactElement {
  return (
    <BaseMenu.RadioItem
      {...props}
      data-slot="menu-radio-item"
      className={cn(menuItemVariants(), className)}
    >
      {children}
      <BaseMenu.RadioItemIndicator>
        <svg viewBox="0 0 16 16" className="size-icon" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="8" r="2.5" />
        </svg>
      </BaseMenu.RadioItemIndicator>
    </BaseMenu.RadioItem>
  )
}

/**
 * A nested menu: the row (`label`) opens a submenu of its `children` to the side on hover, click or
 * the arrow key. The submenu is portalled and stacks above its parent.
 *
 * @example
 * <MenuSub label="Move to"><MenuItem>Inbox</MenuItem><MenuItem>Archive</MenuItem></MenuSub>
 */
export function MenuSub({
  label,
  children,
  sideOffset,
  alignOffset = -4,
  className,
  ...props
}: MenuSubProps): ReactElement {
  return (
    <BaseMenu.SubmenuRoot>
      <BaseMenu.SubmenuTrigger
        {...props}
        label={label}
        data-slot="menu-sub"
        className={cn(menuItemVariants(), className)}
      >
        {label}
        <Glyph d="M6 4l4 4-4 4" className="text-muted-foreground" />
      </BaseMenu.SubmenuTrigger>
      <BaseMenu.Portal>
        <BaseMenu.Positioner
          {...(sideOffset !== undefined && { sideOffset })}
          alignOffset={alignOffset}
          className="z-50 outline-none"
        >
          <BaseMenu.Popup data-slot="menu-content" className={menuContentVariants()}>
            {children}
          </BaseMenu.Popup>
        </BaseMenu.Positioner>
      </BaseMenu.Portal>
    </BaseMenu.SubmenuRoot>
  )
}

/**
 * A hairline between groups of items.
 *
 * @example
 * <MenuSeparator />
 */
export function MenuSeparator({ className, ...props }: MenuSeparatorProps): ReactElement {
  return (
    <BaseMenu.Separator
      {...props}
      data-slot="menu-separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
    />
  )
}
