/**
 * Fixture helper edges: the zone lookup every zoned reading goes through.
 */
import { describe, expect, it } from 'bun:test'
import {
  fmtEur,
  fmtInt,
  fmtShare,
  fmtSignedEur,
  fmtSignedShare,
  withSign,
  zoneFor,
} from './fixture-utils'

const ZONES = [
  { from: 0, to: 10, label: 'Low' },
  { from: 10, to: 20, label: 'Mid' },
  { from: 20, to: 30, label: 'High' },
] as const

describe('zoneFor', () => {
  it('a boundary belongs to the upper zone', () => {
    expect(zoneFor(ZONES, 10)?.label).toBe('Mid')
    expect(zoneFor(ZONES, 0)?.label).toBe('Low')
  })

  it('a value below the scale falls in the first zone', () => {
    expect(zoneFor(ZONES, -5)?.label).toBe('Low')
    const offset = [{ from: 5, to: 10, label: 'Only' }] as const
    expect(zoneFor(offset, 1)?.label).toBe('Only')
  })

  it('a non-finite value has no zone', () => {
    expect(zoneFor(ZONES, Number.NaN)).toBeUndefined()
    expect(zoneFor(ZONES, Number.POSITIVE_INFINITY)).toBeUndefined()
  })

  it('a value at or past the end falls in the last zone', () => {
    expect(zoneFor(ZONES, 30)?.label).toBe('High')
    expect(zoneFor(ZONES, 99)?.label).toBe('High')
  })
})

describe('formatters', () => {
  it('withSign uses the true minus sign', () => {
    expect(withSign(-3, '3')).toBe('\u22123')
    expect(withSign(3, '3')).toBe('+3')
    expect(withSign(0, '0')).toBe('+0')
  })

  it('signs a euro amount and a share', () => {
    expect(fmtSignedEur(123.4)).toBe('+\u20ac123')
    expect(fmtSignedEur(-50)).toBe('\u2212\u20ac50')
    expect(fmtSignedShare(0.134)).toBe('+13%')
    expect(fmtSignedShare(-0.5)).toBe('\u221250%')
  })

  it('formats counts, shares and euros', () => {
    expect(fmtInt(50_542.5)).toBe('50,543')
    expect(fmtShare(0.284)).toBe('28%')
    expect(fmtEur(1499.6)).toBe('\u20ac1,500')
  })
})
