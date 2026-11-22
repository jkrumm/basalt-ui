/**
 * Compile-time proof of the `choice-card` guard, checked by `tsc --noEmit`, and a runtime check that the
 * called props pass through and the cva tables resolve.
 */
import { describe, expect, test } from 'bun:test'
import { requiresChoiceCard } from './choice-card.guard'
import { choiceCardVariants } from './choice-card'
import { createElement } from 'react'

describe('choice-card guard', () => {
  test('every called prop is accepted and the table resolves', () => {
    const control = createElement('span')
    expect(requiresChoiceCard({ control, label: 'Pro', trailing: '€12' }).label).toBe('Pro')
    expect(choiceCardVariants()).toContain('has-data-checked:border-foreground')
  })
})
