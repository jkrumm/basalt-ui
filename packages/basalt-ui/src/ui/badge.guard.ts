import type { CountBadgeProps, DeltaBadgeProps, LozengeProps } from './badge'

/**
 * Hand-authored guard for `badge` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. `polarity` is required on `DeltaBadge`: a delta with no declared
 * direction of good would guess one.
 */

// basalt:guard requires
type Called = {
  tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'bad' | 'info'
  attention?: boolean
  polarity: 'up-good' | 'up-bad' | 'neutral'
}

export const requires = (
  c: Called,
): Pick<LozengeProps, 'tone'> &
  Pick<CountBadgeProps, 'attention'> &
  Pick<DeltaBadgeProps, 'polarity'> => c

// basalt:guard closed
// @ts-expect-error tone is a closed union, not a free string
export const closedTone: Pick<LozengeProps, 'tone'> = { tone: 'purple' }

// @ts-expect-error polarity has no default: a call without it does not compile
export const requiredPolarity: Pick<DeltaBadgeProps, 'polarity'> = {}
