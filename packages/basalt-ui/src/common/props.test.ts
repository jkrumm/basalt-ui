/**
 * `cx` and the message table. Both are pure, and both are the kind of thing every component will
 * call — the point of the tests is that the joined string and the message SHAPE are pinned, since
 * consumers will grep for `[basalt] <Component>:`.
 */
import { describe, expect, test } from 'bun:test'
import { BASALT_PREFIX, deprecatedProp, duplicateMount, oneOf, requiredProp } from './errors'
import { cx } from './props'

describe('cx', () => {
  test('joins the truthy parts with one space', () => {
    expect(cx('a', 'b')).toBe('a b')
  })

  test('drops false, null, undefined and the empty string', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b')
  })

  test('is the empty string when nothing survives', () => {
    expect(cx(undefined, false)).toBe('')
    expect(cx()).toBe('')
  })
})

describe('errors', () => {
  test('every message opens with the one prefix', () => {
    const messages = [
      requiredProp('C', 'p'),
      oneOf('C', 'p', ['a'], 'z'),
      deprecatedProp('C', 'old', 'new', '2.0'),
      duplicateMount('C'),
    ]
    for (const message of messages) expect(message.startsWith(`${BASALT_PREFIX} C: `)).toBe(true)
  })

  test('requiredProp appends a hint after an em dash, and ends in a period without one', () => {
    expect(requiredProp('SelectFilter', 'field')).toBe(
      '[basalt] SelectFilter: prop "field" is required.',
    )
    expect(requiredProp('SelectFilter', 'field', 'bind it to a store field')).toBe(
      '[basalt] SelectFilter: prop "field" is required — bind it to a store field',
    )
  })

  test('oneOf prints the allowed set and what arrived', () => {
    expect(oneOf('WidgetHeader', 'tier', ['section', 'widget'], 'card')).toBe(
      `[basalt] WidgetHeader: prop "tier" must be one of 'section' | 'widget' — got "card".`,
    )
  })

  // Pinned in full, not by substring: this is the message BOTH single-mount guards print, and its
  // remedy ("mount exactly one, at the app root") is the whole content of the warning.
  test('duplicateMount states the fault and the remedy verbatim', () => {
    expect(duplicateMount('BasaltProvider')).toBe(
      '[basalt] BasaltProvider: more than one instance is mounted at once — mount exactly one, at ' +
        'the app root.',
    )
  })

  test('deprecatedProp names the successor and the removal version', () => {
    expect(deprecatedProp('BasaltProvider', 'sseUrl', 'connectivity', '2.0.0')).toContain(
      'is removed in 2.0.0',
    )
  })
})
