import type { AutocompleteInputProps, ComboboxChipsProps, ComboboxInputProps } from './combobox'

/**
 * Hand-authored guard for `combobox` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject.
 */

// basalt:guard requires
type CalledInput = { size?: 'md' | 'sm'; 'aria-label': string; placeholder?: string }
type CalledChips = { size?: 'md' | 'sm'; 'aria-label': string; placeholder?: string }

export const requiresComboboxInput = (
  c: CalledInput,
): Pick<ComboboxInputProps, 'size' | 'aria-label' | 'placeholder'> => c
export const requiresComboboxChips = (
  c: CalledChips,
): Pick<ComboboxChipsProps, 'size' | 'aria-label' | 'placeholder'> => c

// basalt:guard closed
// @ts-expect-error a ComboboxInput without an accessible name does not type-check
export const unnamed: Pick<ComboboxInputProps, 'aria-label'> = {}
// @ts-expect-error an AutocompleteInput without an accessible name does not type-check
export const unnamedAutocomplete: Pick<AutocompleteInputProps, 'aria-label'> = {}
// @ts-expect-error a size outside the union is a type error
export const closedSize: Pick<ComboboxInputProps, 'size'> = { size: 'unknown' }
