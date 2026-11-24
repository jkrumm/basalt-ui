import type { SwatchPickerProps, SwatchToken } from './swatch-picker'

/**
 * Hand-authored guard for `swatch-picker` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The guard pins the props a caller binds.
 */

// basalt:guard requires
type CalledSwatchPicker = {
  options: readonly { value: SwatchToken; label: string }[]
  value?: SwatchToken
  onValueChange?: (value: SwatchToken) => void
  name?: string
  disabled?: boolean
  onBlur?: () => void
}

export const requiresSwatchPicker = (
  c: CalledSwatchPicker,
): Pick<
  SwatchPickerProps,
  'options' | 'value' | 'onValueChange' | 'name' | 'disabled' | 'onBlur'
> => c

// basalt:guard closed
// @ts-expect-error a free color value is not a choice
export const free: Pick<SwatchPickerProps, 'value'> = { value: '#ff0000' }
