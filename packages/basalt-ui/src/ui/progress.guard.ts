import type { ProgressProps, RingProps } from './progress'

/**
 * Hand-authored guard for `progress` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. A bar and a ring are named by type: no `aria-label` and no
 * `aria-labelledby` does not compile.
 */

// basalt:guard requires
type Called = {
  tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'bad' | 'info'
  value: number | null
  min?: number
  max?: number
}
type CalledRing = {
  tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'bad' | 'info'
  value: number
  min?: number
  max?: number
  digits?: number
}

export const requires = (c: Called): Pick<ProgressProps, 'tone' | 'value' | 'min' | 'max'> => c
export const requiresRing = (
  c: CalledRing,
): Pick<RingProps, 'tone' | 'value' | 'min' | 'max' | 'digits'> => c

// basalt:guard closed
// @ts-expect-error tone is a closed union, not a free string
export const closedTone: Pick<ProgressProps, 'tone'> = { tone: 'purple' }

// @ts-expect-error a progress bar needs a name
export const unnamedProgress: ProgressProps = { value: 40 }

// @ts-expect-error a ring needs a name
export const unnamedRing: RingProps = { value: 40 }
