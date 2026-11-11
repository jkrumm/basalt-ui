import type { NativeSelectProps, SelectProps, SelectTriggerProps } from './select'

/**
 * Hand-authored guard for `select` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject.
 */

// basalt:guard requires
type CalledSelect = { size?: 'md' | 'sm' }
type CalledTrigger = { size?: 'md' | 'sm'; 'aria-label'?: string; 'aria-labelledby'?: string }
type CalledNative = { size?: 'md' | 'sm'; value?: string; name?: string; disabled?: boolean }

export const requiresSelect = (c: CalledSelect): Pick<SelectProps, 'size'> => c
export const requiresSelectTrigger = (
  c: CalledTrigger,
): Pick<SelectTriggerProps, 'size' | 'aria-label' | 'aria-labelledby'> => c
export const requiresNativeSelect = (
  c: CalledNative,
): Pick<NativeSelectProps, 'size' | 'value' | 'name' | 'disabled'> => c

// basalt:guard closed
// @ts-expect-error a Select without an accessible name does not type-check
export const unnamed: SelectProps = { options: [] }
// @ts-expect-error a SelectTrigger without an accessible name does not type-check
export const unnamedTrigger: SelectTriggerProps = {}
// @ts-expect-error a size outside the union is a type error
export const closedSize: Pick<SelectProps, 'size'> = { size: 'unknown' }
