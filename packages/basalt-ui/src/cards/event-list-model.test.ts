import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import {
  LARGE_FEED,
  groupByDay,
  isLongBody,
  periodOf,
  resetLargeFeedWarning,
  warnLargeFeed,
} from './event-list-model'

const utc = (y: number, m: number, d: number, h = 12, mi = 0): Date =>
  new Date(Date.UTC(y, m - 1, d, h, mi))
const dayOf = (at: Date): string => at.toISOString().slice(0, 10)
const ids = (
  groups: ReturnType<typeof groupByDay<{ id: string; at: Date | number }>>,
): string[][] => groups.map((g) => g.items.map((i) => i.id))

describe('groupByDay', () => {
  test('splits at midnight and keeps the caller order', () => {
    const groups = groupByDay(
      [
        { id: 'a', at: utc(2026, 3, 2, 23, 59) },
        { id: 'b', at: utc(2026, 3, 3, 0, 0) },
        { id: 'c', at: utc(2026, 3, 3, 9) },
      ],
      dayOf,
    )
    expect(ids(groups)).toEqual([['a'], ['b', 'c']])
    expect(groups.map((g) => g.id)).toEqual(['2026-03-02#0', '2026-03-03#0'])
  })

  test('a run that returns to an earlier day is a new group, never merged', () => {
    const groups = groupByDay(
      [
        { id: 'a', at: utc(2026, 3, 2) },
        { id: 'b', at: utc(2026, 3, 3) },
        { id: 'c', at: utc(2026, 3, 2) },
      ],
      dayOf,
    )
    expect(groups).toHaveLength(3)
    expect(groups.map((g) => g.id)).toEqual(['2026-03-02#0', '2026-03-03#0', '2026-03-02#1'])
  })

  test('an invalid timestamp joins the run before it and makes no header of its own', () => {
    const groups = groupByDay(
      [
        { id: 'a', at: utc(2026, 3, 2) },
        { id: 'x', at: Number.NaN },
        { id: 'b', at: utc(2026, 3, 3) },
      ],
      dayOf,
    )
    expect(ids(groups)).toEqual([['a', 'x'], ['b']])
  })

  test('a leading invalid timestamp joins the first real run', () => {
    const groups = groupByDay(
      [
        { id: 'x', at: Number.NaN },
        { id: 'a', at: utc(2026, 3, 2) },
      ],
      dayOf,
    )
    expect(ids(groups)).toEqual([['x', 'a']])
  })

  test('a list with no real instant is one group on an invalid day', () => {
    const groups = groupByDay([{ id: 'x', at: Number.NaN }], dayOf)
    expect(groups).toHaveLength(1)
    expect(Number.isFinite(groups[0]!.day.getTime())).toBe(false)
  })

  test('an empty list has no groups', () => {
    expect(groupByDay([], dayOf)).toEqual([])
  })

  test('numbers are instants too', () => {
    const groups = groupByDay(
      [
        { id: 'a', at: utc(2026, 3, 2).getTime() },
        { id: 'b', at: utc(2026, 3, 2, 18).getTime() },
      ],
      dayOf,
    )
    expect(ids(groups)).toEqual([['a', 'b']])
  })

  test('the caller decides what a day is', () => {
    const groups = groupByDay(
      [
        { id: 'a', at: utc(2026, 3, 2, 23) },
        { id: 'b', at: utc(2026, 3, 3, 1) },
      ],
      () => 'one-day',
    )
    expect(ids(groups)).toEqual([['a', 'b']])
  })
})

describe('warnLargeFeed', () => {
  afterEach(resetLargeFeedWarning)

  test('is silent at the limit and warns once above it', () => {
    const warn = spyOn(console, 'warn').mockImplementation(() => undefined)
    warnLargeFeed(LARGE_FEED)
    expect(warn).not.toHaveBeenCalled()
    warnLargeFeed(LARGE_FEED + 1)
    warnLargeFeed(LARGE_FEED + 50)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})

describe('periodOf', () => {
  // Monday 2026-11-23: the week runs 23 Nov to 29 Nov.
  const now = utc(2026, 11, 23, 9)
  const keyOf = (at: Date, o?: Parameters<typeof periodOf>[2]): string => periodOf(at, now, o).key
  const kindOf = (at: Date, o?: Parameters<typeof periodOf>[2]): string => periodOf(at, now, o).kind

  test('names today and yesterday, then the week, the month, earlier months and years', () => {
    expect(kindOf(utc(2026, 11, 23, 1))).toBe('today')
    expect(kindOf(utc(2026, 11, 22, 23))).toBe('yesterday')
    expect(kindOf(utc(2026, 11, 20))).toBe('month')
    expect(kindOf(utc(2026, 11, 1))).toBe('month')
    expect(keyOf(utc(2026, 10, 31, 23))).toBe('2026-10')
    expect(kindOf(utc(2026, 8, 3))).toBe('monthOf')
    expect(keyOf(utc(2025, 12, 31))).toBe('2025')
    expect(kindOf(utc(2025, 12, 31))).toBe('year')
  })

  test('days: false folds today and yesterday into the week they fall in', () => {
    const thursday = utc(2026, 11, 26, 9)
    expect(periodOf(utc(2026, 11, 26, 8), thursday, { days: false }).kind).toBe('week')
    expect(periodOf(utc(2026, 11, 25), thursday, { days: false }).kind).toBe('week')
    expect(periodOf(utc(2026, 11, 22), thursday, { days: false }).kind).toBe('month')
  })

  test('the week starts on the day the caller names', () => {
    const sunday = { days: false, weekStartsOn: 0 as const }
    // Sunday 22 Nov starts the week that holds Monday 23 Nov.
    expect(kindOf(utc(2026, 11, 22), sunday)).toBe('week')
    expect(kindOf(utc(2026, 11, 22), { days: false })).toBe('month')
  })

  test('a moment after the week keeps its own month, a later year its number', () => {
    expect(kindOf(utc(2026, 11, 29), { days: false })).toBe('week')
    expect(keyOf(utc(2026, 11, 30), { days: false })).toBe('2026-11')
    expect(keyOf(utc(2026, 12, 5), { days: false })).toBe('2026-12')
    expect(keyOf(utc(2027, 1, 5), { days: false })).toBe('2027')
  })

  test("the calendar is the zone's: 23:30 UTC is already tomorrow in Berlin", () => {
    const late = utc(2026, 11, 22, 23, 30)
    expect(kindOf(late)).toBe('yesterday')
    expect(kindOf(late, { timeZone: 'Europe/Berlin' })).toBe('today')
  })
})

describe('isLongBody', () => {
  test('a long or multi-line body folds, a short one does not', () => {
    expect(isLongBody('Rolling out to 25% of traffic.')).toBe(false)
    expect(isLongBody('x'.repeat(91))).toBe(true)
    expect(isLongBody('one\ntwo')).toBe(true)
  })
})
