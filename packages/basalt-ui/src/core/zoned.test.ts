import { describe, expect, test } from 'bun:test'
import {
  addDays,
  addMonths,
  isCalendarDate,
  monthGridOf,
  offsetAt,
  startOfWeek,
  weekStartOf,
  zonedDay,
  zonedInstant,
} from './zoned'

const H = 3_600_000

describe('zoned days', () => {
  test('a day starts at its zone midnight, east and west of UTC', () => {
    expect(zonedInstant('2026-11-23', 'Europe/Berlin')).toBe(Date.UTC(2026, 10, 22, 23))
    expect(zonedInstant('2026-11-23', 'America/New_York')).toBe(Date.UTC(2026, 10, 23, 5))
    expect(zonedInstant('2026-11-23', 'UTC', 9 * 60 + 30)).toBe(Date.UTC(2026, 10, 23, 9, 30))
  })

  test('the spring-forward day in Berlin is 23 hours long and keeps its wall times', () => {
    const start = zonedInstant('2026-03-29', 'Europe/Berlin')
    const next = zonedInstant('2026-03-30', 'Europe/Berlin')
    expect(start).toBe(Date.UTC(2026, 2, 28, 23))
    expect(next - start).toBe(23 * H)
    // 03:00 local is after the switch: UTC+2.
    expect(zonedInstant('2026-03-29', 'Europe/Berlin', 180)).toBe(Date.UTC(2026, 2, 29, 1))
    expect(offsetAt(Date.UTC(2026, 2, 29, 0, 30), 'Europe/Berlin')).toBe(H)
    expect(offsetAt(Date.UTC(2026, 2, 29, 1, 30), 'Europe/Berlin')).toBe(2 * H)
  })

  test('the fall-back day in New York is 25 hours long', () => {
    const start = zonedInstant('2026-11-01', 'America/New_York')
    expect(zonedInstant('2026-11-02', 'America/New_York') - start).toBe(25 * H)
  })

  test('an instant falls on its zone day with its minutes since midnight', () => {
    const late = Date.UTC(2026, 10, 23, 23, 30)
    expect(zonedDay(late, 'Europe/Berlin')).toEqual({ day: '2026-11-24', minutes: 30 })
    expect(zonedDay(late, 'America/Los_Angeles')).toEqual({
      day: '2026-11-23',
      minutes: 15 * 60 + 30,
    })
  })

  test('day arithmetic and grids are zone-free', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(isCalendarDate('2026-02-31')).toBe(false)
    expect(startOfWeek('2026-11-23', 0)).toBe('2026-11-22')
    expect(startOfWeek('2026-11-23', 1)).toBe('2026-11-23')
    const grid = monthGridOf('2026-11-23', 1)
    expect(grid).toHaveLength(42)
    expect(grid[0]).toBe('2026-10-26')
  })

  test('the week start follows the locale', () => {
    expect(weekStartOf('en-US')).toBe(0)
    expect(weekStartOf('de-DE')).toBe(1)
    expect(weekStartOf('en-GB')).toBe(1)
  })
})
