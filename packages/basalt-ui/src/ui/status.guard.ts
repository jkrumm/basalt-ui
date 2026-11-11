import type { StatusProps, SwatchProps } from './status'

/**
 * Hand-authored guard for `status` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. A `Swatch` colour is a `VX.*` or `groupTokens` ref, never a raw
 * colour: the hand-built chip with a literal fill is what `Swatch` replaces.
 */

// basalt:guard requires
type Called = {
  tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'bad' | 'info'
}

export const requires = (c: Called): Pick<StatusProps, 'tone'> => c

// basalt:guard closed
// @ts-expect-error tone is a closed union, not a free string
export const closedTone: Pick<StatusProps, 'tone'> = { tone: 'purple' }

// @ts-expect-error a raw hex colour is not a series colour
// theme-allow raw-hex — the guard proves a raw colour fails to type-check
export const rawHex: Pick<SwatchProps, 'color'> = { color: '#2f6fed' }

// @ts-expect-error a colour name is not a series colour
export const rawName: Pick<SwatchProps, 'color'> = { color: 'red' }

// @ts-expect-error a swatch with no colour is an empty box
export const noColor: Pick<SwatchProps, 'color'> = {}
