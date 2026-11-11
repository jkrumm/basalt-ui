import type { AccordionProps } from './accordion'

/**
 * Hand-authored guard for `accordion` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject.
 */

// basalt:guard requires
type Called = { hiddenUntilFound?: boolean; keepMounted?: boolean }

export const requires = (c: Called): Pick<AccordionProps, 'hiddenUntilFound' | 'keepMounted'> => c

// basalt:guard closed
// @ts-expect-error hiddenUntilFound is a boolean, not a free string
export const closedHidden: Pick<AccordionProps, 'hiddenUntilFound'> = { hiddenUntilFound: 'yes' }
