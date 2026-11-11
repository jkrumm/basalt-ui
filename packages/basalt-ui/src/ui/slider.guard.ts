import type { SliderProps } from './slider'

/**
 * Hand-authored guard for `slider` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. A slider has no variant axes: the contract is the value shape, the
 * step and the per-thumb names composites call.
 */

// basalt:guard requires
type Called = {
  value?: number | readonly number[]
  defaultValue?: number | readonly number[]
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  thumbLabels?: readonly string[]
  'aria-label'?: string
}

export const requires = (
  c: Called,
): Pick<
  SliderProps<number | readonly number[]>,
  'value' | 'defaultValue' | 'min' | 'max' | 'step' | 'disabled' | 'thumbLabels' | 'aria-label'
> => c

// basalt:guard closed
// @ts-expect-error a slider takes a number or an array of numbers, not a string
export const closedValue: Pick<SliderProps, 'value'> = { value: '5' }
