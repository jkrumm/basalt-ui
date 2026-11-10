import type { InputProps } from './input'

/**
 * Hand-authored guard for `input` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject.
 */

// basalt:guard requires
type Called = { size?: 'md' | 'sm' }

export const requires = (c: Called): Pick<InputProps, 'size'> => c

// basalt:guard closed
// @ts-expect-error a size outside the union is a type error
export const closedSize: Pick<InputProps, 'size'> = { size: 'unknown' }
