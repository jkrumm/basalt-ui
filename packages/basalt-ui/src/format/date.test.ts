/**
 * Coverage for `format/date.ts` — weekday, relativeTime, date/time/dateTime and the duration
 * family. `now` is injected everywhere so no test reads the wall clock.
 */
import { describe, expect, test } from 'bun:test'
import { date, dateTime, duration, durationClock, relativeTime, time, weekday } from './date'
import { NON_FINITE } from './shared'

const en = { locale: 'en-US' } as const
const now = Date.parse('2026-09-02T12:00:00Z')
const MIN = 60_000
const HOUR = 3_600_000
const DAY = 86_400_000

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
  test('under a minute is the locale\'s "now", never hard-coded English', () => {
    expect(relativeTime(now - 30_000, { now, ...en })).toBe('now')
    expect(relativeTime(now + 30_000, { now, ...en })).toBe('now')
    expect(relativeTime(now - 30_000, { now, locale: 'de' })).toBe('jetzt')
  })

  test('an hour ago / in an hour (future works)', () => {
    expect(relativeTime(now - HOUR, { now, ...en })).toBe('1 hour ago')
    expect(relativeTime(now + HOUR, { now, ...en })).toBe('in 1 hour')
    expect(relativeTime(now + DAY, { now, ...en })).toBe('tomorrow')
  })

  test('rounds first, then promotes the unit', () => {
    expect(relativeTime(now - (HOUR - 1_000), { now, ...en })).toBe('1 hour ago')
    expect(relativeTime(now - (DAY - 60_000), { now, ...en })).toBe('yesterday')
    expect(relativeTime(now - 59 * MIN, { now, ...en })).toBe('59 minutes ago')
  })

  test('numeric: "always" drops the idioms', () => {
    expect(relativeTime(now - DAY, { now, numeric: 'always', ...en })).toBe('1 day ago')
    expect(relativeTime(now - 30_000, { now, numeric: 'always', ...en })).toBe('0 seconds ago')
  })

  test('style narrows the unit labels', () => {
    const long = relativeTime(now - 3 * HOUR, { now, ...en })
    const short = relativeTime(now - 3 * HOUR, { now, style: 'short', ...en })
    expect(long).toBe('3 hours ago')
    expect(short).not.toBe(long)
    expect(short.length).toBeLessThan(long.length)
  })

  test('a de locale', () => {
    expect(relativeTime(now - 3 * HOUR, { now, locale: 'de' })).toBe('vor 3 Stunden')
  })

  test('accepts a Date or an ISO string, not just epoch ms', () => {
    expect(relativeTime(new Date(now - HOUR), { now, ...en })).toBe('1 hour ago')
    expect(relativeTime(new Date(now - HOUR).toISOString(), { now, ...en })).toBe('1 hour ago')
  })

  test('non-finite, unparseable, null and undefined print the sentinel', () => {
    expect(relativeTime('not a date', { now })).toBe(NON_FINITE)
    expect(relativeTime(NaN, { now })).toBe(NON_FINITE)
    expect(relativeTime(Infinity, { now })).toBe(NON_FINITE)
    expect(relativeTime(null, { now })).toBe(NON_FINITE)
    expect(relativeTime(undefined, { now })).toBe(NON_FINITE)
  })

  test('finite-but-absurd timestamps still format', () => {
    expect(() => relativeTime(8_640_000_000_000_000, { now })).not.toThrow()
    expect(() => relativeTime(-8_640_000_000_000_000, { now })).not.toThrow()
  })
})

describe('date / time / dateTime', () => {
  const at = Date.parse('2026-09-02T15:04:05Z')
  const utc = { ...en, timeZone: 'UTC' } as const

  test('date: short / medium / long', () => {
    expect(date(at, { ...utc, format: 'short' })).toBe('9/2/26')
    expect(date(at, { ...utc, format: 'medium' })).toBe('Sep 2, 2026')
    expect(date(at, { ...utc, format: 'long' })).toBe('September 2, 2026')
  })

  test('date defaults to medium', () => {
    expect(date(at, utc)).toBe('Sep 2, 2026')
  })

  test('a YYYY-MM-DD string is a calendar date, whatever the time zone', () => {
    expect(date('2026-09-02', en)).toBe('Sep 2, 2026')
    expect(date('2026-09-02', { ...en, timeZone: 'Pacific/Kiritimati' })).toBe('Sep 2, 2026')
    expect(date('2026-09-02', { ...en, timeZone: 'Pacific/Pago_Pago' })).toBe('Sep 2, 2026')
  })

  test('timeZone moves the calendar day of an instant', () => {
    expect(date(at, { ...en, timeZone: 'Pacific/Auckland' })).toBe('Sep 3, 2026')
  })

  test('locale', () => {
    expect(date(at, { locale: 'de', timeZone: 'UTC', format: 'long' })).toBe('2. September 2026')
  })

  test('time and dateTime', () => {
    expect(time(at, { ...utc, format: 'short' })).toBe('3:04 PM')
    expect(time(at, { ...utc, format: 'medium' })).toBe('3:04:05 PM')
    expect(dateTime(at, { ...utc, format: 'short' })).toBe('9/2/26, 3:04 PM')
  })

  test('null, undefined and unparseable print the sentinel', () => {
    for (const f of [date, time, dateTime]) {
      expect(f(null)).toBe(NON_FINITE)
      expect(f(undefined)).toBe(NON_FINITE)
      expect(f('nope')).toBe(NON_FINITE)
      expect(f(NaN)).toBe(NON_FINITE)
    }
  })
})

describe('duration', () => {
  test('clock matches durationClock', () => {
    expect(duration(3723, { style: 'clock' })).toBe(durationClock(3723))
    expect(duration(70, { style: 'clock' })).toBe('01:10')
  })

  test('compact', () => {
    expect(duration(3900, { style: 'compact' })).toBe('1h 05m')
    expect(duration(3723, { style: 'compact' })).toBe('1h 02m 03s')
    expect(duration(3603, { style: 'compact' })).toBe('1h 00m 03s')
    expect(duration(45, { style: 'compact' })).toBe('45s')
    expect(duration(0, { style: 'compact' })).toBe('0s')
  })

  test('long', () => {
    expect(duration(3900, { style: 'long', locale: 'en-US' })).toBe('1 hour 5 minutes')
    expect(duration(3900, { style: 'long', locale: 'de' })).toBe('1 Stunde 5 Minuten')
  })

  test('largest caps the leading unit', () => {
    expect(duration(90_000, { style: 'compact' })).toBe('25h')
    expect(duration(90_000, { style: 'compact', largest: 'day' })).toBe('1d 01h')
    expect(duration(5400, { style: 'compact', largest: 'minute' })).toBe('90m')
  })

  test('null, undefined and non-finite print the sentinel; negatives clamp to zero', () => {
    expect(duration(null)).toBe(NON_FINITE)
    expect(duration(undefined, { style: 'long' })).toBe(NON_FINITE)
    expect(duration(NaN, { style: 'compact' })).toBe(NON_FINITE)
    expect(duration(-5, { style: 'compact' })).toBe('0s')
  })
})
