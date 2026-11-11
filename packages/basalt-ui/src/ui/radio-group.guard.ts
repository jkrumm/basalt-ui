import type { RadioGroupProps, RadioProps } from './radio-group'

/**
 * Hand-authored guard for `radio-group` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The module has no cva axes, so the guard pins the props a caller
 * binds.
 */

// basalt:guard requires
type CalledGroup = {
  value?: string
  defaultValue?: string
  name?: string
  disabled?: boolean
}
type CalledRadio = { value: string; disabled?: boolean }

export const requiresGroup = (
  c: CalledGroup,
): Pick<RadioGroupProps, 'value' | 'defaultValue' | 'name' | 'disabled'> => c
export const requiresRadio = (c: CalledRadio): Pick<RadioProps, 'value' | 'disabled'> => c

// basalt:guard closed
// @ts-expect-error a radio is identified by its value
export const valueless: Pick<RadioProps, 'value'> = {}
