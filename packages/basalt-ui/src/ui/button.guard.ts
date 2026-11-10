import type { ButtonProps, PressableProps } from './button'

/**
 * Hand-authored guard for `button` (docs/v3/ARCHITECTURE.md 4.2). Two halves:
 *
 * - `requires`: the axes npm composites call. Removing one from `ButtonProps` fails `tsc` here;
 *   adding one does not. It survives eject.
 * - `closed`: `@ts-expect-error` lines that prove the unions stay closed. Dropped on eject.
 */

// basalt:guard requires
type Called = {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'md' | 'icon'
  loading?: boolean
}
type CalledPressable = { size?: 'none' | 'row' | 'chip' }

export const requires = (c: Called): Pick<ButtonProps, 'variant' | 'size' | 'loading'> => c
export const requiresPressable = (c: CalledPressable): Pick<PressableProps, 'size'> => c

// basalt:guard closed
// @ts-expect-error a variant outside the union is a type error
export const closedVariant: Pick<ButtonProps, 'variant'> = { variant: 'unknown' }
// @ts-expect-error a Pressable size outside the union is a type error
export const closedPressable: Pick<PressableProps, 'size'> = { size: 'unknown' }
// @ts-expect-error an icon-only button needs a name
export const unnamedIcon: ButtonProps = { size: 'icon' }
