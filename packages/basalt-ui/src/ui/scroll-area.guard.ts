import type { ScrollAreaProps } from './scroll-area'

/**
 * Hand-authored guard for `scroll-area` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The tab stop is the part's to manage, so `tabIndex` is not a prop.
 */

// basalt:guard requires
type Called = { orientation?: 'vertical' | 'horizontal' | 'both' }

export const requires = (c: Called): Pick<ScrollAreaProps, 'orientation'> => c

// basalt:guard closed
// @ts-expect-error orientation is vertical, horizontal or both, not a free string
export const closedOrientation: Pick<ScrollAreaProps, 'orientation'> = { orientation: 'diagonal' }

// @ts-expect-error the part sets tabindex itself, only while it scrolls
export const ownTabIndex: Pick<ScrollAreaProps, 'tabIndex'> = { tabIndex: 0 }
