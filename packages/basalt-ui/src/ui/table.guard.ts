import type { TableProps } from './table'

/**
 * Hand-authored guard for `table` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject.
 */

// basalt:guard requires
type Called = { size?: 'md' | 'sm'; look?: 'reading' | 'grid' }

export const requires = (c: Called): Pick<TableProps, 'size' | 'look'> => c

// basalt:guard closed
// @ts-expect-error size is md or sm, not a free string
export const closedSize: Pick<TableProps, 'size'> = { size: 'unknown' }

// @ts-expect-error look is reading or grid, not a free string
export const closedLook: Pick<TableProps, 'look'> = { look: 'striped' }
