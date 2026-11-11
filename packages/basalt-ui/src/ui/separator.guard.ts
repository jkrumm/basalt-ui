import type { SeparatorProps } from './separator'

/**
 * Hand-authored guard for `separator` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject.
 */

// basalt:guard requires
type Called = { orientation?: 'horizontal' | 'vertical' }

export const requires = (c: Called): Pick<SeparatorProps, 'orientation'> => c

// basalt:guard closed
// @ts-expect-error orientation is horizontal or vertical, not a free string
export const closedOrientation: Pick<SeparatorProps, 'orientation'> = { orientation: 'diagonal' }
