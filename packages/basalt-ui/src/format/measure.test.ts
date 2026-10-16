import { describe, expect, test } from 'bun:test'
import { kcal, km } from './measure'
import { NON_FINITE } from './shared'

describe('km', () => {
  test('meters as kilometers, 2 digits by default', () => {
    expect(km(5300, { locale: 'en-US' })).toBe('5.30 km')
    expect(km(5300, { locale: 'en-US', digits: 1 })).toBe('5.3 km')
  })

  test('locale-aware', () => {
    expect(km(5300, { locale: 'de-DE' })).toBe('5,30 km')
  })

  test('negative values keep the sign unless they round to zero', () => {
    expect(km(-5300, { locale: 'en-US' })).toBe('-5.30 km')
    expect(km(-1, { locale: 'en-US' })).toBe('0.00 km')
  })

  test('negative zero and nullish', () => {
    expect(km(-0, { locale: 'en-US' })).toBe('0.00 km')
    expect(km(null)).toBe(NON_FINITE)
    expect(km(undefined)).toBe(NON_FINITE)
    expect(km(NaN)).toBe(NON_FINITE)
  })
})

describe('kcal', () => {
  test('whole numbers below 1000, "k kcal" above', () => {
    expect(kcal(842, { locale: 'en-US' })).toBe('842 kcal')
    expect(kcal(1243, { locale: 'en-US' })).toBe('1.24k kcal')
    expect(kcal(1243, { locale: 'en-US', digits: 1 })).toBe('1.2k kcal')
    expect(kcal(1243, { locale: 'de-DE' })).toBe('1,24k kcal')
  })

  test('rounds first, then promotes at the boundary', () => {
    const en = { locale: 'en-US' } as const
    expect(kcal(999, en)).toBe('999 kcal')
    expect(kcal(999.4, en)).toBe('999 kcal')
    expect(kcal(999.5, en)).toBe('1k kcal')
    expect(kcal(999.6, en)).toBe('1k kcal')
    expect(kcal(-999.6, en)).toBe('-1k kcal')
    expect(kcal(-1243, en)).toBe('-1.24k kcal')
    expect(kcal(1000, en)).toBe('1k kcal')
    expect(kcal(1_500_000, en)).toBe('1,500k kcal')
    expect(kcal(999_995, en)).toBe('1,000k kcal')
    expect(kcal(999.995, { ...en, digits: 0 })).toBe('1k kcal')
  })

  test('negative zero and nullish', () => {
    expect(kcal(-0, { locale: 'en-US' })).toBe('0 kcal')
    expect(kcal(null)).toBe(NON_FINITE)
    expect(kcal(Infinity)).toBe(NON_FINITE)
  })
})
