import type { NumberFieldProps } from './number-field'

/**
 * Hand-authored guard for `number-field` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject.
 */

// basalt:guard requires
type Called = {
  size?: 'md' | 'sm'
  value?: number | null
  defaultValue?: number
  min?: number
  max?: number
  step?: number
  locale?: string
}

export const requires = (
  c: Called,
): Pick<NumberFieldProps, 'size' | 'value' | 'defaultValue' | 'min' | 'max' | 'step' | 'locale'> =>
  c

// basalt:guard closed
// @ts-expect-error a size outside the union is a type error
export const closedSize: Pick<NumberFieldProps, 'size'> = { size: 'unknown' }
