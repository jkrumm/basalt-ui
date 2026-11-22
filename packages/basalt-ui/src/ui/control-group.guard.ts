import type { ButtonGroupProps, ControlGroupProps, InputGroupProps } from './control-group'

/**
 * Hand-authored guard for `control-group` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives
 * eject; `closed` is dropped on eject.
 */

// basalt:guard requires
type Called = {
  size?: 'md' | 'sm'
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  orientation?: 'horizontal' | 'vertical'
  fill?: boolean
}
type CalledInput = { size?: 'md' | 'sm' }

export const requires = (
  c: Called,
): Pick<ButtonGroupProps, 'size' | 'variant' | 'orientation' | 'fill'> => c
export const requiresControl = (
  c: Called,
): Pick<ControlGroupProps, 'size' | 'variant' | 'orientation' | 'fill'> => c
export const requiresInput = (c: CalledInput): Pick<InputGroupProps, 'size'> => c

// basalt:guard closed
// @ts-expect-error a size outside the union is a type error
export const closedSize: Pick<ButtonGroupProps, 'size'> = { size: 'lg' }
// @ts-expect-error an orientation outside the union is a type error
export const closedOrientation: Pick<ControlGroupProps, 'orientation'> = { orientation: 'diagonal' }
