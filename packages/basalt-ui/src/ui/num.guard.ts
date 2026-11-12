import type { NumProps } from './num'

/**
 * Hand-authored guard for `num` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. `value` takes a number or an absent value, never text: the string
 * a caller formats by hand is what `Num` replaces.
 */

// basalt:guard requires
type Called = {
  tone?: 'neutral' | 'accent' | 'good' | 'warn' | 'bad' | 'info'
  value: number | null | undefined
}

export const requires = (c: Called): Pick<NumProps, 'tone' | 'value'> => c

// basalt:guard closed
// @ts-expect-error tone is a closed union, not a free string
export const closedTone: Pick<NumProps, 'tone'> = { tone: 'purple' }

// @ts-expect-error a formatted string is not a figure; pass the number
export const textValue: Pick<NumProps, 'value'> = { value: '1,234' }
