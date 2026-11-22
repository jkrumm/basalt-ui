/**
 * Compile-time proof of the `tag-input` guard, checked by `tsc --noEmit`, and a runtime check that the
 * called props pass through and the cva tables resolve.
 */
import { describe, expect, test } from 'bun:test'
import { requiresTagInput } from './tag-input.guard'
import { tagInputVariants } from './tag-input'

describe('tag-input guard', () => {
  test('every called prop is accepted and the tables resolve', () => {
    expect(requiresTagInput({ value: ['a'], max: 3, separators: ',' }).max).toBe(3)
    expect(tagInputVariants()).toContain('flex-wrap')
  })
})
