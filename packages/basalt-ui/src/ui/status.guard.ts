import type { StatusProps } from './status'

/**
 * Hand-authored guard for `status` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. A `Swatch` color is a `BASALT.*` or `groupTokens` ref, never a raw
 * color: the hand-built chip with a literal fill is what `Swatch` replaces.
 */

// basalt:guard requires
type Called = {
  tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'bad' | 'info'
}

export const requires = (c: Called): Pick<StatusProps, 'tone'> => c

// basalt:guard closed
// @ts-expect-error tone is a closed union, not a free string
export const closedTone: Pick<StatusProps, 'tone'> = { tone: 'purple' }

// @ts-expect-error a raw hex color is not a series color
export const rawHex: Pick<import('./status').SwatchProps, 'color'> = { color: '#2f6fed' }

// @ts-expect-error a color name is not a series color
export const rawName: Pick<import('./status').SwatchProps, 'color'> = { color: 'red' }

// @ts-expect-error a swatch with no color is an empty box
export const noColor: Pick<import('./status').SwatchProps, 'color'> = {}
