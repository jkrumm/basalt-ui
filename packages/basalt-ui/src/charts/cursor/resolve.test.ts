import { describe, expect, test } from 'bun:test'
import { buildDomainIndex, parseKey, resolveCursorPoint } from './resolve'

type Point = { date: string }

const daily = (days: string[]): Point[] => days.map((d) => ({ date: `2026-08-${d}` }))
const index = (points: Point[]) => buildDomainIndex(points, (p) => p.date)

describe('parseKey', () => {
  test('reads numeric strings as numbers', () => {
    expect(parseKey('42')).toBe(42)
    expect(parseKey('-1.5')).toBe(-1.5)
  })

  test('reads ISO dates as timestamps', () => {
    expect(parseKey('2026-08-18')).toBe(Date.parse('2026-08-18'))
  })

  test('returns null for a plain category', () => {
    expect(parseKey('Direct')).toBeNull()
  })
})

describe('resolveCursorPoint', () => {
  test('resolves an exact key', () => {
    const i = index(daily(['01', '02', '03']))
    expect(resolveCursorPoint(i, '2026-08-02')?.date).toBe('2026-08-02')
  })

  test('resolves a FOLDED sibling key to the nearest own point', () => {
    // The failure this replaced: a chart holding every other day never owned the keys its unfolded sibling
    // broadcast, so the shared crosshair appeared on roughly one hover in two.
    const folded = index(daily(['01', '03', '05']))
    expect(resolveCursorPoint(folded, '2026-08-02')?.date).toBe('2026-08-01')
    expect(resolveCursorPoint(folded, '2026-08-04')?.date).toBe('2026-08-03')
  })

  test('returns null beyond one domain step, so unrelated charts never sync', () => {
    const i = index(daily(['01', '02', '03']))
    expect(resolveCursorPoint(i, '2026-09-30')).toBeNull()
  })

  test('tolerates one step past each end', () => {
    const i = index(daily(['02', '03', '04']))
    expect(resolveCursorPoint(i, '2026-08-01')?.date).toBe('2026-08-02')
    expect(resolveCursorPoint(i, '2026-08-05')?.date).toBe('2026-08-04')
  })

  test('categorical domains fall back to exact match only', () => {
    const points = [{ date: 'Direct' }, { date: 'Referral' }]
    const i = buildDomainIndex(points, (p) => p.date)
    expect(resolveCursorPoint(i, 'Direct')?.date).toBe('Direct')
    expect(resolveCursorPoint(i, 'Organic')).toBeNull()
  })

  test('a single-point chart resolves only its own key', () => {
    const i = index(daily(['01']))
    expect(resolveCursorPoint(i, '2026-08-01')?.date).toBe('2026-08-01')
    expect(resolveCursorPoint(i, '2026-08-02')).toBeNull()
  })
})

describe("resolveCursorPoint — 'leading' resolution (bucket-keyed domains)", () => {
  const weekly = (days: string[]) => buildDomainIndex(daily(days), (p) => p.date, 'leading')

  test('resolves an exact key, same as nearest', () => {
    const i = weekly(['01', '08', '15'])
    expect(resolveCursorPoint(i, '2026-08-08')?.date).toBe('2026-08-08')
  })

  test("a target anywhere inside a bucket resolves to that bucket's LEADING key, not the nearest one", () => {
    // The bug this replaces: a weekly chart keyed by the Monday of each week (step 7 days),
    // hovered from a daily sibling landing in the back half of the bucket, used to resolve to the
    // FOLLOWING week under nearest-match. Every back-half day must resolve to the bucket it is
    // actually inside.
    const i = weekly(['01', '08', '15'])
    expect(resolveCursorPoint(i, '2026-08-02')?.date).toBe('2026-08-01')
    expect(resolveCursorPoint(i, '2026-08-05')?.date).toBe('2026-08-01')
    expect(resolveCursorPoint(i, '2026-08-07')?.date).toBe('2026-08-01')
    expect(resolveCursorPoint(i, '2026-08-09')?.date).toBe('2026-08-08')
    expect(resolveCursorPoint(i, '2026-08-14')?.date).toBe('2026-08-08')
  })

  test('a key BEFORE the first bucket resolves to null — no bucket contains it', () => {
    // Deliberately NOT 'nearest''s one-step tolerance. The first key is the leading edge of the
    // first bucket, so anything earlier is outside every bucket; snapping it onto the first one
    // would paint a crosshair on a bucket that provably does not contain the hovered key.
    const i = weekly(['02', '09', '16'])
    expect(resolveCursorPoint(i, '2026-08-01')).toBeNull()
    expect(resolveCursorPoint(i, '2026-08-02')?.date).toBe('2026-08-02')
  })

  test('the final bucket ends at last + step — that instant is already outside it', () => {
    const i = weekly(['01', '08', '15']) // step = 7, so the last bucket covers [Aug 15, Aug 22)
    expect(resolveCursorPoint(i, '2026-08-21')?.date).toBe('2026-08-15') // last day inside
    expect(resolveCursorPoint(i, '2026-08-22')).toBeNull() // exactly last + step, exclusive
    expect(resolveCursorPoint(i, '2026-08-23')).toBeNull()
  })

  test('returns null well beyond the domain, so unrelated charts never sync', () => {
    const i = weekly(['01', '08', '15'])
    expect(resolveCursorPoint(i, '2026-09-30')).toBeNull()
  })

  test('categorical domains fall back to exact match only, same as nearest', () => {
    const points = [{ date: 'Direct' }, { date: 'Referral' }]
    const i = buildDomainIndex(points, (p) => p.date, 'leading')
    expect(resolveCursorPoint(i, 'Direct')?.date).toBe('Direct')
    expect(resolveCursorPoint(i, 'Organic')).toBeNull()
  })

  test('a single-point chart resolves only its own key', () => {
    const i = weekly(['01'])
    expect(resolveCursorPoint(i, '2026-08-01')?.date).toBe('2026-08-01')
    expect(resolveCursorPoint(i, '2026-08-02')).toBeNull()
  })

  test('an explicit resolution argument overrides the index-built default', () => {
    // Built as 'nearest', resolved as 'leading' — the per-call argument wins.
    const i = index(daily(['01', '08', '15']))
    expect(resolveCursorPoint(i, '2026-08-05', 'leading')?.date).toBe('2026-08-01')
  })
})
