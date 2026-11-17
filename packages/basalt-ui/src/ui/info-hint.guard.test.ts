/**
 * Compile-time proof of the `info-hint` guard, checked by `tsc --noEmit`: a props type that stops
 * accepting a prop callers pass fails, one that accepts more passes. A glossary term outside the
 * glossary is a type error (the `unknownTerm` line in the guard).
 */
import { describe, expect, test } from 'bun:test'
import type { InfoHintProps } from './info-hint'
import { requires, requiresTerm } from './info-hint.guard'

type Called = Parameters<typeof requires>[0]
type Accepts<P> = (c: Called) => P

type OnlyNetLabel = { label: 'Net'; children: InfoHintProps['children'] }
type WithTitleToo = { label: string; children: InfoHintProps['children']; title?: string }

// @ts-expect-error any label string is called but only `Net` is accepted
export const removed: Accepts<OnlyNetLabel> = requires

export const added: Accepts<WithTitleToo> = requires

describe('info-hint guard', () => {
  test('the requires functions pass through', () => {
    expect(requires({ label: 'Net', children: 'After refunds.' })).toEqual({
      label: 'Net',
      children: 'After refunds.',
    })
    expect(requiresTerm({ term: 'errand' })).toEqual({ term: 'errand' })
  })
})
