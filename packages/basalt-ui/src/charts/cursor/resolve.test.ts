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
