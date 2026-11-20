/**
 * Expression cycle 15 (`v3-expr-15-kit-fixes` 9): `money` prints a true minus (U+2212) for a negative
 * amount, where `Intl` prints an ASCII hyphen. A positive amount is unchanged.
 */
import { describe, expect, test } from 'bun:test'
import { money } from './number'

const en = { locale: 'en' } as const

describe('money prints a true minus', () => {
  test('a negative amount carries U+2212', () => {
    expect(money(-60, { ...en, currency: 'EUR' })).toBe('\u2212€60.00')
    expect(money(-1234.5, { ...en, currency: 'USD' })).toBe('\u2212$1,234.50')
  })

  test('a negative compact amount carries U+2212', () => {
    expect(money(-1234, { ...en, currency: 'USD', compact: true })).toBe('\u2212$1.2k')
  })

  test('a positive amount keeps its text', () => {
    expect(money(60, { ...en, currency: 'EUR' })).toBe('€60.00')
  })
})
