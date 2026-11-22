/**
 * Compile-time proof of the `one-time-code` guard, checked by `tsc --noEmit`, and a runtime check that the
 * called props pass through and the cva tables resolve.
 */
import { describe, expect, test } from 'bun:test'
import { requiresOneTimeCode } from './one-time-code.guard'
import { oneTimeCodeVariants } from './one-time-code'

describe('one-time-code guard', () => {
  test('every called prop is accepted and the tables resolve', () => {
    expect(requiresOneTimeCode({ length: 4, value: '12' }).length).toBe(4)
    expect(oneTimeCodeVariants()).toContain('gap-2')
  })
})
