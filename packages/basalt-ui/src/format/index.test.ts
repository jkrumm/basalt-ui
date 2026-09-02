/**
 * Coverage for the new `basalt-ui/format` names — the argo-facing wrappers and the date/duration/
 * measurement formatters seeded from argo's `features/*` files. The number-format law itself
 * (`fmtCompact`/`fmtPercent`/`fmtCurrency`/`fmtInt`, non-finite handling, locale pinning) is
 * already covered by `../charts/utils/format.test.ts`, which now exercises this module through
 * the re-export shim.
 */
import { describe, expect, test } from 'bun:test'
import {
  clock,
  compact,
  deltaPct,
  duration,
  durationClock,
  integer,
  kcal,
  km,
  money,
  NON_FINITE,
  percent,
  relativeTime,
  weekday,
} from './index'

const en = { locale: 'en-US' } as const

describe('money / percent / integer / compact', () => {
  test('money formats a currency amount', () => {
    expect(money(1234, { ...en, currency: 'USD' })).toBe('$1,234')
  })

  test('percent formats a ratio', () => {
    expect(percent(0.42, en)).toBe('42%')
  })

  test('integer groups and rounds', () => {
    expect(integer(12_480.4, en)).toBe('12,480')
  })

  test('compact abbreviates large numbers', () => {
    expect(compact(1200, en)).toBe('1.2k')
  })

  test('all four print the non-finite sentinel for non-finite input', () => {
    expect(money(NaN, { ...en, currency: 'USD' })).toBe(NON_FINITE)
    expect(percent(Infinity, en)).toBe(NON_FINITE)
    expect(integer(NaN, en)).toBe(NON_FINITE)
    expect(compact(-Infinity, en)).toBe(NON_FINITE)
  })
})

describe('deltaPct', () => {
  test('signs a positive delta', () => {
    expect(deltaPct(0.04, en)).toBe('+4%')
  })

  test('signs a negative delta with a real minus, not a double sign', () => {
    expect(deltaPct(-0.12, en)).toBe('-12%')
  })

  test('a zero delta carries no sign', () => {
    expect(deltaPct(0, en)).toBe('0%')
  })

  test('input: "percent" skips the ×100', () => {
    expect(deltaPct(4, { ...en, input: 'percent' })).toBe('+4%')
  })
})

describe('duration', () => {
  test('the brief example: 3723s → "1h 02m"', () => {
    expect(duration(3723)).toBe('1h 02m')
  })

  test('under a minute renders seconds', () => {
    expect(duration(45)).toBe('45s')
  })

  test('minutes alone are not zero-padded', () => {
    expect(duration(300)).toBe('5m')
  })

  test('unit: "minutes" scales the input first', () => {
    expect(duration(90, { unit: 'minutes' })).toBe('1h 30m')
  })

  test('non-finite input prints the sentinel', () => {
    expect(duration(NaN)).toBe(NON_FINITE)
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

describe('clock', () => {
  test('renders a local (per timeZone) HH:mm', () => {
    expect(clock(new Date('2026-01-01T09:41:00Z'), { timeZone: 'UTC', ...en })).toBe('09:41')
  })

  test('non-finite/unparseable input prints the sentinel', () => {
    expect(clock('not a date')).toBe(NON_FINITE)
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
    expect(km(5300)).toBe('5.30 km')
    expect(km(5300, { digits: 1 })).toBe('5.3 km')
  })

  test('kcal compacts to "k cal" above 1000', () => {
    expect(kcal(842)).toBe('842 kcal')
    expect(kcal(1243)).toBe('1.24 k cal')
  })

  test('non-finite input prints the sentinel', () => {
    expect(km(NaN)).toBe(NON_FINITE)
    expect(kcal(Infinity)).toBe(NON_FINITE)
  })
})
