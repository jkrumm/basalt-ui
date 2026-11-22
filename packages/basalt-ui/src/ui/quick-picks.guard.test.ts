/**
 * Compile-time proof of the `quick-picks` guard, checked by `tsc --noEmit`, and a runtime check that the
 * called props pass through and the cva tables resolve.
 */
import { describe, expect, test } from 'bun:test'
import { requiresQuickPicks } from './quick-picks.guard'
import { quickPicksVariants } from './quick-picks'

describe('quick-picks guard', () => {
  test('every called prop is accepted and the tables resolve', () => {
    const options = [{ value: 'today', label: 'Today' }]
    expect(requiresQuickPicks({ options, value: 'today' }).options).toBe(options)
    expect(quickPicksVariants()).toContain('flex-wrap')
  })
})
