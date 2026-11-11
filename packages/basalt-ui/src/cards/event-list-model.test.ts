import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import { LARGE_FEED, groupByDay, resetLargeFeedWarning, warnLargeFeed } from './event-list-model'

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
