import { describe, expect, test } from 'bun:test'
import { createFormat } from './format'

const f = createFormat({ locale: 'en', timeZone: 'UTC' })
const AT = new Date('2026-09-02T15:04:05Z')

describe('number, percent, money', () => {
  test('group and round per the locale', () => {
    expect(f.number(12480)).toBe('12,480')
    expect(f.number(-0)).toBe('0')
    expect(f.number(1.23456, { maximumFractionDigits: 2 })).toBe('1.23')
    expect(f.percent(0.42)).toBe('42%')
    expect(f.percent(0.4237, { minimumFractionDigits: 1, maximumFractionDigits: 1 })).toBe('42.4%')
    expect(f.money(12.5, 'USD')).toBe('$12.50')
    expect(f.money(1234, 'JPY')).toBe('¥1,234')
  })
})

describe('date, dateTime, time', () => {
  test('styles', () => {
    expect(f.date(AT)).toBe('Sep 2, 2026')
    expect(f.date(AT, 'long')).toBe('September 2, 2026')
    expect(f.date(AT, 'month')).toBe('September 2026')
    expect(f.date(AT, 'weekday')).toBe('Wed')
    expect(f.dateTime(AT)).toMatch(/^Sep 2, 2026(,| at) 3:04\sPM$/)
    expect(f.time(AT)).toMatch(/^3:04\sPM$/)
    expect(f.time(AT, { hour12: false })).toBe('15:04')
  })

  test('epoch milliseconds and an explicit zone', () => {
    expect(f.time(AT.getTime(), { timeZone: 'Asia/Tokyo' })).toMatch(/^12:04\sAM$/)
  })

  test('English prints Sep, not Sept, for any region', () => {
    expect(createFormat({ locale: 'en-GB' }).date(AT)).toBe('2 Sep 2026')
  })

  test('a CalendarDate ignores o.timeZone', () => {
    expect(f.date('2026-09-02', 'short', { timeZone: 'Pacific/Auckland' })).toBe('Sep 2, 2026')
  })
})

describe('relative', () => {
  const now = AT.getTime()
  test('picks the unit by magnitude and rounds before promoting', () => {
    expect(f.relative(now - 3 * 3_600_000, now)).toBe('3 hours ago')
    expect(f.relative(now + 2 * 86_400_000, now)).toBe('in 2 days')
    expect(f.relative(now - 59.6 * 60_000, now)).toBe('1 hour ago')
    expect(f.relative(now, now)).toBe('now')
    expect(f.relative(new Date(now - 1000), new Date(now))).toBe('now')
  })

  test('is deterministic when now is passed', () => {
    expect(f.relative(0, 86_400_000)).toBe(f.relative(0, 86_400_000))
  })
})

describe('duration, plural', () => {
  test('clock form of milliseconds', () => {
    expect(f.duration(3_723_000)).toBe('1:02:03')
    expect(f.duration(252_000)).toBe('04:12')
    expect(f.duration(-5)).toBe('00:00')
  })

  test('plural categories follow the locale', () => {
    expect(f.plural(1)).toBe('one')
    expect(f.plural(2)).toBe('other')
    expect(createFormat({ locale: 'de' }).plural(1)).toBe('one')
  })
})
