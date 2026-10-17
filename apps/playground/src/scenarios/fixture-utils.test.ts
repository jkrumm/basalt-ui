/**
 * Fixture helper edges: the zone lookup every zoned reading goes through.
 */
import { describe, expect, it } from 'bun:test'
import { zoneFor } from './fixture-utils'

const ZONES = [
  { from: 0, to: 10, label: 'Low' },
  { from: 10, to: 20, label: 'Mid' },
  { from: 20, to: 30, label: 'High' },
] as const

describe('zoneFor', () => {
  it('a boundary belongs to the upper zone', () => {
    expect(zoneFor(ZONES, 10).label).toBe('Mid')
    expect(zoneFor(ZONES, 0).label).toBe('Low')
  })

  it('a value below the scale falls in the first zone', () => {
    expect(zoneFor(ZONES, -5).label).toBe('Low')
  })

  it('a value at or past the end falls in the last zone', () => {
    expect(zoneFor(ZONES, 30).label).toBe('High')
    expect(zoneFor(ZONES, 99).label).toBe('High')
  })
})
