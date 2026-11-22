import type { CheckboxMatrixProps } from './checkbox-matrix'

/**
 * Hand-authored guard for `checkbox-matrix` (docs/v3/ARCHITECTURE.md 4.2). `requires` survives eject;
 * `closed` is dropped on eject. The guard pins the props a caller binds.
 */

// basalt:guard requires
type CalledCheckboxMatrix = {
  rows: readonly { id: string; label: string }[]
  columns: readonly { id: string; label: string }[]
  rowToggles?: boolean
  columnToggles?: boolean
  name?: string
  disabled?: boolean
  onBlur?: () => void
}

export const requiresCheckboxMatrix = (
  c: CalledCheckboxMatrix,
): Pick<
  CheckboxMatrixProps,
  'rows' | 'columns' | 'rowToggles' | 'columnToggles' | 'name' | 'disabled' | 'onBlur'
> => c

// basalt:guard closed
// @ts-expect-error a matrix is its rows
export const rowless: Pick<CheckboxMatrixProps, 'rows'> = {}
