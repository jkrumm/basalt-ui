import { afterEach, describe, expect, test } from 'bun:test'
import { bytes, compact, delta, integer, money, percent } from './number'
import { NON_FINITE, resetFormatDefaults } from './shared'

const en = { locale: 'en-US' } as const

afterEach(resetFormatDefaults)

describe('money', () => {
  test('keeps the currency default fraction digits', () => {
    expect(money(12.5, { ...en, currency: 'USD' })).toBe('$12.50')
    expect(money(1234.56, { locale: 'de-DE', currency: 'EUR' })).toBe('1.234,56 €')
    expect(money(1234.56, { ...en, currency: 'JPY' })).toBe('¥1,235')
  })

  test('explicit digits is an opt-in', () => {
    expect(money(1234.56, { ...en, currency: 'USD', digits: 0 })).toBe('$1,235')
    expect(money(12, { ...en, currency: 'USD', digits: 1 })).toBe('$12.0')
  })

  test('compact digits sets the max fraction digits', () => {
    expect(money(1234, { ...en, currency: 'USD', compact: true, digits: 2 })).toBe('$1.23k')
  })

  test('compact keeps one optional fraction digit', () => {
    expect(money(1234, { ...en, currency: 'USD', compact: true })).toBe('$1.2k')
    expect(money(1000, { ...en, currency: 'USD', compact: true })).toBe('$1k')
  })
})

describe('compact', () => {
  test('is public and lowercases the K', () => {
    expect(compact(1234, en)).toBe('1.2k')
    expect(compact(3_400_000, en)).toBe('3.4M')
    expect(compact(-820, en)).toBe('-820')
    expect(compact(1234, { ...en, digits: 2 })).toBe('1.23k')
  })
})

describe('integer / percent', () => {
  test('normalise negative zero', () => {
    expect(integer(-0, en)).toBe('0')
    expect(integer(-0.4, en)).toBe('0')
    expect(percent(-0.0001, en)).toBe('0%')
  })

  test('percent input modes', () => {
    expect(percent(0.42, en)).toBe('42%')
    expect(percent(42, { ...en, input: 'percent' })).toBe('42%')
  })
})

describe('bytes', () => {
  test('decimal (SI) units', () => {
    expect(bytes(0, en)).toBe('0 B')
    expect(bytes(512, en)).toBe('512 B')
    expect(bytes(1_200_000, en)).toBe('1.2 MB')
    expect(bytes(1_234_567, { ...en, digits: 2 })).toBe('1.23 MB')
    expect(bytes(1500, { locale: 'de-DE' })).toBe('1,5 kB')
    expect(bytes(-1500, en)).toBe('-1.5 kB')
  })

  test('rounds first, then promotes the unit at the boundary', () => {
    expect(bytes(999, en)).toBe('999 B')
    expect(bytes(999.5, en)).toBe('1 kB')
    expect(bytes(999.6, en)).toBe('1 kB')
    expect(bytes(-999.6, en)).toBe('-1 kB')
    expect(bytes(999_949, en)).toBe('999.9 kB')
    expect(bytes(999_950, en)).toBe('1 MB')
    expect(bytes(999_999, en)).toBe('1 MB')
    expect(bytes(1_000_000, en)).toBe('1 MB')
  })
})

describe('delta', () => {
  test('always signs non-zero values', () => {
    expect(delta(3.2, en)).toBe('+3.2')
    expect(delta(-1, en)).toBe('-1')
    expect(delta(0, en)).toBe('0')
    expect(delta(-0, en)).toBe('0')
    expect(delta(0.01, { ...en, digits: 0 })).toBe('0')
    expect(delta(3.14259, { ...en, digits: 2 })).toBe('+3.14')
  })
})

describe('null-safety', () => {
  test('every number formatter prints the sentinel for null / undefined / NaN', () => {
    for (const v of [null, undefined, NaN]) {
      expect(integer(v)).toBe(NON_FINITE)
      expect(percent(v)).toBe(NON_FINITE)
      expect(compact(v)).toBe(NON_FINITE)
      expect(money(v, { currency: 'USD' })).toBe(NON_FINITE)
      expect(bytes(v)).toBe(NON_FINITE)
      expect(delta(v)).toBe(NON_FINITE)
    }
  })
})
