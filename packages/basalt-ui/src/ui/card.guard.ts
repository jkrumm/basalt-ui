import type { CardProps } from './card'

/**
 * Hand-authored guard for `card` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject.
 */

// basalt:guard requires
type Called = { flush?: boolean }

export const requires = (c: Called): Pick<CardProps, 'flush'> => c

// basalt:guard closed
// @ts-expect-error flush is a boolean, not a free string
export const closedFlush: Pick<CardProps, 'flush'> = { flush: 'unknown' }
