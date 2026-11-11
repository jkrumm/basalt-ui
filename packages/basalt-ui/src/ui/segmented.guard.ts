import type { SegmentedProps } from './segmented'

/**
 * Hand-authored guard for `segmented` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject.
 */

// basalt:guard requires
type Called = {
  size?: 'md' | 'sm'
  multiple?: false
  value?: string
  defaultValue?: string
  disabled?: boolean
  options: readonly { value: string; label: string; disabled?: boolean }[]
}

export const requires = (
  c: Called,
): Pick<SegmentedProps, 'size' | 'multiple' | 'value' | 'defaultValue' | 'disabled' | 'options'> =>
  c

// basalt:guard closed
// @ts-expect-error a size outside the union is a type error
export const closedSize: Pick<SegmentedProps, 'size'> = { size: 'unknown' }

// @ts-expect-error options and children are one or the other
export const both: SegmentedProps = { options: [], children: 'x' }
