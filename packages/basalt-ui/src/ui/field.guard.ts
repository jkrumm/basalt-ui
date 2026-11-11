import type { FieldProps } from './field'

/**
 * Hand-authored guard for `field` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject.
 */

// basalt:guard requires
type Called = {
  label: string
  description?: string
  error?: string
  invalid?: boolean
}

export const requires = (
  c: Called,
): Pick<FieldProps, 'label' | 'description' | 'error' | 'invalid'> => c

// basalt:guard closed
// @ts-expect-error a field needs a label: the control has no accessible name without one
export const unlabelled: Pick<FieldProps, 'label'> = {}
// @ts-expect-error an error is text, not a number or a node
export const nonTextError: Pick<FieldProps, 'error'> = { error: 42 }
