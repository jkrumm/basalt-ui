/**
 * Coverage for the new `basalt-ui/format` names — the argo-facing wrappers and the date/duration/
 * measurement formatters seeded from argo's `features/*` files. The number-format law itself
 * (`compact`/`percent`/`money`/`integer`, non-finite handling, locale pinning) is
 * already covered by `../charts/utils/format.test.ts`, which now exercises this module through
 * the re-export shim.
 */
import { describe, expect, test } from 'bun:test'
import { durationClock, integer, kcal, km, money, percent, relativeTime, weekday } from './index'
import { NON_FINITE } from './shared'

const en = { locale: 'en-US' } as const

describe('money / percent / integer', () => {
  test('money formats a currency amount', () => {
    expect(money(1234, { ...en, currency: 'USD' })).toBe('$1,234.00')
  })

  test('percent formats a ratio', () => {
    expect(percent(0.42, en)).toBe('42%')
  })

  test('integer groups and rounds', () => {
    expect(integer(12_480.4, en)).toBe('12,480')
  })

  test('all three print the non-finite sentinel for non-finite input', () => {
    expect(money(NaN, { ...en, currency: 'USD' })).toBe(NON_FINITE)
    expect(percent(Infinity, en)).toBe(NON_FINITE)
    expect(integer(NaN, en)).toBe(NON_FINITE)
  })
})

describe('durationClock', () => {
  test('h:mm:ss once an hour is present', () => {
    expect(durationClock(3723)).toBe('1:02:03')
  })

  test('mm:ss under an hour', () => {
    expect(durationClock(70)).toBe('01:10')
  })
})

describe('weekday', () => {
  test('a YYYY-MM-DD string is read as a local calendar date', () => {
    expect(weekday('2026-09-02', en)).toBe('Wed')
  })

  test('a Date works the same way', () => {
    expect(weekday(new Date(2026, 8, 2), en)).toBe('Wed')
  })

  test('format: "long" gives the full name', () => {
    expect(weekday('2026-09-02', { ...en, format: 'long' })).toBe('Wednesday')
  })
})

describe('relativeTime', () => {
  const now = Date.parse('2026-09-02T12:00:00Z')

  test('under a minute reads "just now"', () => {
    expect(relativeTime(now - 30_000, { now })).toBe('just now')
  })

  test('an hour ago', () => {
    expect(relativeTime(now - 3_600_000, { now })).toBe('1 hour ago')
  })

  test('accepts a Date or an ISO string, not just epoch ms', () => {
    expect(relativeTime(new Date(now - 3_600_000), { now })).toBe('1 hour ago')
    expect(relativeTime(new Date(now - 3_600_000).toISOString(), { now })).toBe('1 hour ago')
  })

  test('non-finite/unparseable input prints the sentinel', () => {
    expect(relativeTime('not a date', { now })).toBe(NON_FINITE)
  })
})

describe('km / kcal', () => {
  test('km defaults to 2 fraction digits', () => {
    expect(km(5300, en)).toBe('5.30 km')
    expect(km(5300, { ...en, digits: 1 })).toBe('5.3 km')
  })

  test('kcal compacts to "k kcal" above 1000', () => {
    expect(kcal(842, en)).toBe('842 kcal')
    expect(kcal(1243, en)).toBe('1.24k kcal')
  })

  test('non-finite input prints the sentinel', () => {
    expect(km(NaN)).toBe(NON_FINITE)
    expect(kcal(Infinity)).toBe(NON_FINITE)
  })
})
