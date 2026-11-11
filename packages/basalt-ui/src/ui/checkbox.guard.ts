import type { CheckboxGroupProps, CheckboxProps } from './checkbox'

/**
 * Hand-authored guard for `checkbox` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The module has no cva axes, so the guard pins the props a caller
 * binds.
 */

// basalt:guard requires
type CalledGroup = {
  value?: string[]
  defaultValue?: string[]
  disabled?: boolean
}
type CalledCheckbox = {
  checked?: boolean
  defaultChecked?: boolean
  indeterminate?: boolean
  value?: string
  name?: string
  disabled?: boolean
}

export const requiresGroup = (
  c: CalledGroup,
): Pick<CheckboxGroupProps, 'value' | 'defaultValue' | 'disabled'> => c
export const requiresCheckbox = (
  c: CalledCheckbox,
): Pick<
  CheckboxProps,
  'checked' | 'defaultChecked' | 'indeterminate' | 'value' | 'name' | 'disabled'
> => c

// basalt:guard closed
// @ts-expect-error the check is drawn by the part, not passed in
export const withChildren: Pick<CheckboxProps, 'children'> = { children: 'x' }
