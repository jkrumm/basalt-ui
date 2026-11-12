import type { ToolbarButtonProps, ToolbarProps } from './toolbar'

/**
 * Hand-authored guard for `toolbar` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. A toolbar and an icon-only button are named by type.
 */

// basalt:guard requires
type Called = {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'md' | 'icon'
}

export const requires = (c: Called): Pick<ToolbarButtonProps, 'variant' | 'size'> => c

// basalt:guard closed
// @ts-expect-error a variant outside the union is a type error
export const closedVariant: Pick<ToolbarButtonProps, 'variant'> = { variant: 'unknown' }

// @ts-expect-error an icon-only toolbar button needs a name
export const unnamedIcon: ToolbarButtonProps = { size: 'icon' }

// @ts-expect-error a toolbar needs a name
export const unnamedToolbar: ToolbarProps = {}
