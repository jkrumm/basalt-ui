import type { TableProps } from './table'

/**
 * Hand-authored guard for `table` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject.
 */

// basalt:guard requires
type Called = { size?: 'md' | 'compact' }

export const requires = (c: Called): Pick<TableProps, 'size'> => c

// basalt:guard closed
// @ts-expect-error size is md or compact, not a free string
export const closedSize: Pick<TableProps, 'size'> = { size: 'unknown' }
