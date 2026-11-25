import { Menu as BaseMenu } from '@base-ui/react/menu'
import { useRender } from '@base-ui/react/use-render'
import { createContext, use, useMemo, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { cn } from '../core/cn'
import { ControlScopeProvider } from '../core/control-scope'
import { useContextTrigger } from '../core/context-trigger'
import type { ContextPoint } from '../core/context-trigger'
import { menuContentVariants } from './menu'
import type { MenuContentProps } from './menu'

/** Every `data-slot` this module renders, in export order. Read by the generator for `SLOTS`. */
export const contextMenuParts = ['context-menu-trigger', 'context-menu-content'] as const

type ContextMenuState = {
  open: boolean
  /** Where the last open happened; `null` until the first, which is also when the popup mounts. */
  at: ContextPoint | null
  disabled: boolean
  openAt(at: ContextPoint): void
  setOpen(open: boolean): void
}

const ContextMenuContext = createContext<ContextMenuState | null>(null)

function useContextMenuState(part: string): ContextMenuState {
  const state = use(ContextMenuContext)
  if (state === null) throw new Error(`${part} must sit inside a ContextMenu`)
  return state
}

export type ContextMenuProps = {
  children?: ReactNode
  /** Starts open at the top-left corner, for a docs frame or a test; a user opens it at a point. */
  defaultOpen?: boolean | undefined
  /** Opt out: right click, long press and Shift+F10 fall through to the browser. */
  disabled?: boolean | undefined
  /** Called when the menu opens or closes. */
  onOpenChange?: ((open: boolean) => void) | undefined
}

export type ContextMenuTriggerProps = Omit<useRender.ComponentProps<'div'>, 'className'> & {
  /** Layout only (`w-full`, `mt-2`). */
  className?: string | undefined
}

export type ContextMenuContentProps = Omit<MenuContentProps, 'anchor' | 'container'>

/**
 * The popup's way to name the pointer: a zero-size rect at the point, stable while the point holds
 * so the positioner does not re-measure on every render.
 */
function useVirtualAnchor(at: ContextPoint | null): { getBoundingClientRect: () => DOMRect } {
  const x = at?.x ?? 0
  const y = at?.y ?? 0
  return useMemo(
    () => ({ getBoundingClientRect: () => DOMRect.fromRect({ x, y, width: 0, height: 0 }) }),
    [x, y],
  )
}

/** Focus the first enabled row once the popup is on screen, the way a keyboard open does. */
function focusFirstItem(popup: HTMLElement | null): void {
  if (popup === null) return
  requestAnimationFrame(() => {
    popup.querySelector<HTMLElement>('[role^="menuitem"]:not([data-disabled])')?.focus()
  })
}

/**
 * The same list of actions as a part's "..." button, opened where the pointer is. Right click,
 * a long press on touch, and Shift+F10 or the context-menu key on the focused part open it; a
 * modifier right click (Shift) and a right click inside a text field keep the browser's menu.
 * While it is open the trigger carries `data-popup-open`, which a part styles as selected. The
 * popup mounts on the first open, so a closed one costs a state hook and a few handlers.
 *
 * Compose the items from `MenuItem`, `MenuGroup` and `MenuSeparator` in `basalt-ui/ui/menu`, built
 * from the same data as the "..." menu so there is one list, never two.
 *
 * @useWhen a row, card or item already has a "..." menu and a right click should open the same actions
 * @neverWhen the part has no menu of its own (the browser's menu stays), or the list picks a form value (use `Select`)
 *
 * @example
 * <ContextMenu>
 *   <ContextMenuTrigger render={<li />}>Invoice 1042</ContextMenuTrigger>
 *   <ContextMenuContent>
 *     <MenuItem onClick={rename}>Rename</MenuItem>
 *   </ContextMenuContent>
 * </ContextMenu>
 */
export function ContextMenu({
  children,
  defaultOpen = false,
  disabled = false,
  onOpenChange,
}: ContextMenuProps): ReactElement {
  const [open, setOpen] = useState(defaultOpen)
  const [at, setAt] = useState<ContextPoint | null>(defaultOpen ? { x: 0, y: 0 } : null)
  const state = useMemo<ContextMenuState>(
    () => ({
      open,
      at,
      disabled,
      openAt: (point) => {
        setAt(point)
        setOpen(true)
        onOpenChange?.(true)
      },
      setOpen: (next) => {
        setOpen(next)
        onOpenChange?.(next)
      },
    }),
    [open, at, disabled, onOpenChange],
  )
  return <ContextMenuContext value={state}>{children}</ContextMenuContext>
}

/**
 * The element a right click, a long press or Shift+F10 opens the menu from. It renders a `div`;
 * `render` swaps the element (a table row, a card) and keeps its own props and handlers.
 *
 * @example
 * <ContextMenuTrigger render={<tr />}>...</ContextMenuTrigger>
 */
export function ContextMenuTrigger({
  render,
  className,
  ...props
}: ContextMenuTriggerProps): ReactElement {
  const state = useContextMenuState('ContextMenuTrigger')
  const trigger = useContextTrigger({ onOpen: state.openAt, disabled: state.disabled })
  return useRender({
    render,
    defaultTagName: 'div',
    props: {
      ...trigger,
      ...props,
      'data-slot': 'context-menu-trigger',
      'data-popup-open': state.open ? '' : undefined,
      className: cn(className),
    },
  })
}

/**
 * The popup, opened at the point of the last right click or long press (or beside the focused part
 * for a keyboard open) and kept on screen by flipping. It mounts on the first open.
 *
 * @example
 * <ContextMenuContent><MenuItem onClick={remove}>Delete</MenuItem></ContextMenuContent>
 */
export function ContextMenuContent({
  side = 'bottom',
  align = 'start',
  sideOffset = 2,
  alignOffset = 2,
  className,
  children,
  ...props
}: ContextMenuContentProps): ReactElement | null {
  const state = useContextMenuState('ContextMenuContent')
  const anchor = useVirtualAnchor(state.at)
  if (state.at === null) return null
  return (
    <BaseMenu.Root open={state.open} onOpenChange={state.setOpen}>
      <ControlScopeProvider value={null}>
        <BaseMenu.Portal>
          <BaseMenu.Positioner
            anchor={anchor}
            side={side}
            align={align}
            sideOffset={sideOffset}
            alignOffset={alignOffset}
            className="z-50 outline-none"
          >
            <BaseMenu.Popup
              {...props}
              // The popup is portalled but React still bubbles its events to the trigger's tree: a
              // click or a key in it must not reach the row or card it opens from.
              onClick={(event) => {
                props.onClick?.(event)
                event.stopPropagation()
              }}
              onKeyDown={(event) => {
                props.onKeyDown?.(event)
                event.stopPropagation()
              }}
              ref={focusFirstItem}
              data-slot="context-menu-content"
              className={cn(menuContentVariants(), className)}
            >
              {children}
            </BaseMenu.Popup>
          </BaseMenu.Positioner>
        </BaseMenu.Portal>
      </ControlScopeProvider>
    </BaseMenu.Root>
  )
}
