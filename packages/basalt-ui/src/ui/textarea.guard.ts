import type { TextareaProps } from './textarea'

/**
 * Hand-authored guard for `textarea` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The module has no cva axes, so the guard pins the props a caller
 * binds.
 */

// basalt:guard requires
type Called = {
  value?: string
  defaultValue?: string
  rows?: number
  disabled?: boolean
  name?: string
}

export const requires = (
  c: Called,
): Pick<TextareaProps, 'value' | 'defaultValue' | 'rows' | 'disabled' | 'name'> => c

// basalt:guard closed
// @ts-expect-error height is the fixed `rows`; there is no autosize prop
export const autosizing: TextareaProps = { autosize: true }
