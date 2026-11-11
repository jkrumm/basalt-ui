import type { CollapsibleContentProps } from './collapsible'

/**
 * Hand-authored guard for `collapsible` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject.
 */

// basalt:guard requires
type Called = { hiddenUntilFound?: boolean; keepMounted?: boolean }

export const requires = (
  c: Called,
): Pick<CollapsibleContentProps, 'hiddenUntilFound' | 'keepMounted'> => c

// basalt:guard closed
// @ts-expect-error keepMounted is a boolean, not a free string
export const closedKeep: Pick<CollapsibleContentProps, 'keepMounted'> = { keepMounted: 'yes' }
