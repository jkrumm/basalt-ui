import type {
  MenuCheckboxItemProps,
  MenuContentProps,
  MenuItemProps,
  MenuProps,
  MenuRadioGroupProps,
  MenuSubProps,
} from './menu'

/**
 * Hand-authored guard for `menu` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject; `closed`
 * is dropped on eject. There are no variant axes; `anchor`, `finalFocus` and `closeOnClick` keep the
 * Base UI names.
 */

// basalt:guard requires
type CalledMenu = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  modal?: boolean
}
type CalledContent = {
  anchor?: Element | { getBoundingClientRect: () => DOMRect } | null
  side?: 'top' | 'bottom' | 'left' | 'right'
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
  finalFocus?: boolean
}
type CalledItem = {
  closeOnClick?: boolean
  disabled?: boolean
  onClick?: () => void
}
type CalledCheckbox = {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  closeOnClick?: boolean
}
type CalledRadioGroup = {
  value?: string
  defaultValue?: string
  onValueChange?: (v: string) => void
}
type CalledSub = { label: string; disabled?: boolean }

export const requiresMenu = (
  c: CalledMenu,
): Pick<MenuProps, 'open' | 'defaultOpen' | 'onOpenChange' | 'modal'> => c
export const requiresMenuContent = (
  c: CalledContent,
): Pick<MenuContentProps, 'anchor' | 'side' | 'align' | 'sideOffset' | 'finalFocus'> => c
export const requiresMenuItem = (
  c: CalledItem,
): Pick<MenuItemProps, 'closeOnClick' | 'disabled' | 'onClick'> => c
export const requiresMenuCheckboxItem = (
  c: CalledCheckbox,
): Pick<MenuCheckboxItemProps, 'checked' | 'defaultChecked' | 'onCheckedChange' | 'closeOnClick'> =>
  c
export const requiresMenuRadioGroup = (
  c: CalledRadioGroup,
): Pick<MenuRadioGroupProps, 'value' | 'defaultValue' | 'onValueChange'> => c
export const requiresMenuSub = (c: CalledSub): Pick<MenuSubProps, 'label' | 'disabled'> => c

// basalt:guard closed
// @ts-expect-error a submenu row without a label fails to type-check
export const unlabelledSub: Pick<MenuSubProps, 'label'> = {}
// @ts-expect-error a side outside the union is a type error
export const closedSide: Pick<MenuContentProps, 'side'> = { side: 'middle' }
