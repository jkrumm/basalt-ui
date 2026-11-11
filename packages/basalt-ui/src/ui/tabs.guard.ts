import type { TabsProps } from './tabs'

/**
 * Hand-authored guard for `tabs` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject.
 */

// basalt:guard requires
type Called = { size?: 'md' | 'sm' }

export const requires = (c: Called): Pick<TabsProps, 'size'> => c

// basalt:guard closed
// @ts-expect-error size is md or sm, not a free string
export const closedSize: Pick<TabsProps, 'size'> = { size: 'unknown' }
