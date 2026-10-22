import { describe, expect, test } from 'bun:test'
import { dayKey, defaultDayLabel, formatEventTime, groupByDay } from './event-list-model'

const local = (y: number, m: number, d: number, h = 12, mi = 0): Date =>
  new Date(y, m - 1, d, h, mi)

describe('groupByDay', () => {
  test('splits at local midnight and keeps the caller order', () => {
    const items = [
      { id: 'a', at: local(2026, 3, 2, 23, 59) },
      { id: 'b', at: local(2026, 3, 3, 0, 0) },
      { id: 'c', at: local(2026, 3, 3, 9) },
    ]
    const groups = groupByDay(items)
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([['a'], ['b', 'c']])
    expect(groups.map((g) => g.key)).toEqual(['2026-03-02', '2026-03-03'])
  })

  test('a run that returns to an earlier day is a new group, never merged', () => {
    const groups = groupByDay([
      { id: 'a', at: local(2026, 3, 2) },
      { id: 'b', at: local(2026, 3, 3) },
      { id: 'c', at: local(2026, 3, 2) },
    ])
    expect(groups).toHaveLength(3)
  })

  test('an invalid timestamp joins the run before it and makes no header of its own', () => {
    const groups = groupByDay([
      { id: 'a', at: local(2026, 3, 2) },
      { id: 'bad', at: Number.NaN },
      { id: 'c', at: new Date('nope') },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.items.map((i) => i.id)).toEqual(['a', 'bad', 'c'])
  })

  test('a leading invalid timestamp joins the first real run, not a dash group of its own', () => {
    const groups = groupByDay([
      { id: 'bad', at: Number.NaN },
      { id: 'a', at: local(2026, 3, 2) },
      { id: 'b', at: local(2026, 3, 1) },
    ])
    expect(groups.map((g) => g.items.map((i) => i.id))).toEqual([['bad', 'a'], ['b']])
    expect(groups.every((g) => Number.isFinite(g.day.getTime()))).toBe(true)
  })

  test('a list with no real instant is one group on an invalid day', () => {
    const groups = groupByDay([
      { id: 'x', at: Number.NaN },
      { id: 'y', at: new Date('nope') },
    ])
    expect(groups).toHaveLength(1)
    expect(Number.isFinite(groups[0]?.day.getTime() ?? 0)).toBe(false)
  })

  test('group ids carry the occurrence of the day, stable under a same-day prepend', () => {
    const run = (extra: boolean) =>
      groupByDay([
        ...(extra ? [{ id: 'n', at: local(2026, 3, 3, 11) }] : []),
        { id: 'a', at: local(2026, 3, 3, 9) },
        { id: 'b', at: local(2026, 3, 2) },
        { id: 'c', at: local(2026, 3, 3, 8) },
      ]).map((g) => g.id)
    expect(run(false)).toEqual(['2026-03-03#0', '2026-03-02#0', '2026-03-03#1'])
    expect(run(true)).toEqual(run(false))
  })

  test('numbers are instants too', () => {
    expect(groupByDay([{ id: 'a', at: local(2026, 3, 2).getTime() }])[0]?.key).toBe(
      dayKey(local(2026, 3, 2)),
    )
  })
})

describe('defaultDayLabel', () => {
  const now = local(2026, 3, 10, 8)
  test('Today and Yesterday', () => {
    expect(defaultDayLabel(local(2026, 3, 10, 0, 5), now)).toBe('Today')
    expect(defaultDayLabel(local(2026, 3, 9, 23, 55), now)).toBe('Yesterday')
  })
  test('Yesterday crosses a month boundary', () => {
    expect(defaultDayLabel(local(2026, 2, 28), local(2026, 3, 1))).toBe('Yesterday')
  })
  test('older days read as weekday and date', () => {
    const label = defaultDayLabel(local(2026, 3, 2), now)
    expect(label).toContain('Mon')
    expect(label).toContain('2026')
  })
})

describe('formatEventTime', () => {
  const now = local(2026, 3, 10, 12)
  const at = local(2026, 3, 10, 9, 30)
  test('clock has no date', () => {
    expect(formatEventTime(at, 'clock', now)).toMatch(/9:30/)
    expect(formatEventTime(at, 'clock', now)).not.toMatch(/2026|26/)
  })
  test('date-time carries the day', () => {
    expect(formatEventTime(at, 'date-time', now)).toMatch(/9:30/)
    expect(formatEventTime(at, 'date-time', now).length).toBeGreaterThan(
      formatEventTime(at, 'clock', now).length,
    )
  })
  test('relative is measured from now', () => {
    expect(formatEventTime(at, 'relative', now)).toBe('3 hours ago')
  })
  test('an invalid instant is a dash, never a throw', () => {
    expect(formatEventTime(new Date(Number.NaN), 'clock', now)).toBe('—')
    expect(formatEventTime(new Date(Number.NaN), 'relative', now)).toBe('—')
  })
  test('a function wins', () => {
    expect(formatEventTime(at, () => 'x', now)).toBe('x')
  })
})
