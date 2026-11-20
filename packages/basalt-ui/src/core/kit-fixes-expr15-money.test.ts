/**
 * Expression cycle 15 (`v3-expr-15-kit-fixes` 9): `useFormat().money` (the `Format` the hook returns)
 * prints a true minus for a negative amount, as `money` in the format module does.
 */
import { describe, expect, test } from 'bun:test'
import { createFormat } from './format'

const f = createFormat({ locale: 'en', timeZone: 'UTC' })

describe('Format.money', () => {
  test('a negative amount prints U+2212', () => {
    expect(f.money(-60, 'EUR')).toBe('\u2212€60.00')
  })
})
