/**
 * Expression cycle 15 (`v3-expr-15-kit-fixes` 9): a `c.money` cell prints a negative amount with a
 * true minus (U+2212), the same glyph `useFormat().money` prints.
 */
import { describe, expect, test } from 'bun:test'
import { createFormat } from '../../core/format'
import { formatMoney } from './kinds-cells'

describe('c.money cell text', () => {
  test('a negative amount prints U+2212 in the currency digits', () => {
    expect(formatMoney(createFormat({ locale: 'en' }), -60, 'EUR')).toBe('\u221260.00')
  })
})
