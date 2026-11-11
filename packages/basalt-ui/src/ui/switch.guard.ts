import type { SwitchProps } from './switch'

/**
 * Hand-authored guard for `switch` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The module has no cva axes, so the guard pins the props a caller
 * binds.
 */

// basalt:guard requires
type Called = {
  checked?: boolean
  defaultChecked?: boolean
  disabled?: boolean
  name?: string
}

export const requires = (
  c: Called,
): Pick<SwitchProps, 'checked' | 'defaultChecked' | 'disabled' | 'name'> => c

// basalt:guard closed
// @ts-expect-error the track and thumb are drawn by the part, not passed in
export const withChildren: Pick<SwitchProps, 'children'> = { children: 'x' }
