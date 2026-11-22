/**
 * Compile-time proof of the `checkbox-matrix` guard, checked by `tsc --noEmit`, and a runtime check that the
 * called props pass through and the cva tables resolve.
 */
import { describe, expect, test } from 'bun:test'
import { requiresCheckboxMatrix } from './checkbox-matrix.guard'
import { checkboxMatrixVariants } from './checkbox-matrix'

describe('checkbox-matrix guard', () => {
  test('every called prop is accepted and the table resolves', () => {
    const rows = [{ id: 'a', label: 'A' }]
    expect(requiresCheckboxMatrix({ rows, columns: rows, rowToggles: true }).rows).toBe(rows)
    expect(checkboxMatrixVariants()).toContain('overflow-x-auto')
  })
})
