import type { MeterProps } from './meter'

/**
 * Hand-authored guard for `meter` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. Zones are `MeterSpec` from `src/core/ports.ts`: two or more, each
 * with a `label`, because a verdict is never colour alone.
 */

// basalt:guard requires
type Called = {
  tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'bad' | 'info'
  label: string
  value: number | null
  min?: number
  max: number
}

export const requires = (c: Called): Pick<MeterProps, 'tone' | 'label' | 'value' | 'min' | 'max'> =>
  c

// basalt:guard closed
// @ts-expect-error tone is a closed union, not a free string
export const closedTone: Pick<MeterProps, 'tone'> = { tone: 'purple' }

export const unlabelledZone: Pick<MeterProps, 'zones'> = {
  zones: [
    { to: 1, tone: 'good', label: 'Fine' },
    // @ts-expect-error a zone without a label is colour alone
    { to: 2, tone: 'bad' },
  ],
}

// @ts-expect-error a zoned meter has at least two zones
export const oneZone: Pick<MeterProps, 'zones'> = { zones: [{ to: 2, tone: 'good', label: 'All' }] }

// @ts-expect-error a meter needs a name
export const unnamed: Pick<MeterProps, 'label'> = {}
