import { describe, expect, test } from 'bun:test'
import { padAutoLower, padAutoUpper } from './domain'

describe('padAutoLower', () => {
  test('stays at 0 for the default zero-baseline case (never goes negative)', () => {
    // yAutoMinCeil default 0, positive-only data (e.g. dataMin=78) -> candidate = min(78, 0) = 0.
    expect(padAutoLower(0, 1.1)).toBe(0)
  })

  test('pads DOWN below a positive candidate (yAutoMinCeil=Infinity, no forced zero baseline)', () => {
    // Body-weight case: min=78, max=84, default pad 1.1. candidate = min(78, Infinity) = 78.
    expect(padAutoLower(78, 1.1)).toBeCloseTo(70.909, 3)
  })

  test('pads further negative for a negative candidate (unchanged prior behavior)', () => {
    expect(padAutoLower(-5, 1.1)).toBeCloseTo(-5.5, 5)
  })

  test('lower never lands above the candidate it was derived from', () => {
    for (const candidate of [-10, -0.5, 0, 0.5, 10, 78]) {
      expect(padAutoLower(candidate, 1.1)).toBeLessThanOrEqual(candidate)
    }
  })
})

describe('padAutoUpper', () => {
  test('stays at 0 (never pushed positive)', () => {
    expect(padAutoUpper(0, 1.1)).toBe(0)
  })

  test('pads UP above a positive candidate', () => {
    expect(padAutoUpper(78, 1.1)).toBeCloseTo(85.8, 5)
  })

  test('pads further up (toward and past zero) for a negative candidate', () => {
    expect(padAutoUpper(-5, 1.1)).toBeCloseTo(-4.5454, 3)
  })

  test('upper never lands below the candidate it was derived from', () => {
    for (const candidate of [-10, -0.5, 0, 0.5, 10, 78]) {
      expect(padAutoUpper(candidate, 1.1)).toBeGreaterThanOrEqual(candidate)
    }
  })

  test('the autoMaxFloor case: dataMax 3.2, pad 1.1, floor 6 -> 6.6', () => {
    expect(padAutoUpper(Math.max(3.2, 6), 1.1)).toBeCloseTo(6.6, 5)
  })

  test('is the exact mirror of padAutoLower — same magnitude, opposite direction', () => {
    for (const candidate of [-10, -0.5, 0.5, 10, 78]) {
      expect(padAutoUpper(candidate, 1.1)).toBeCloseTo(-padAutoLower(-candidate, 1.1), 5)
    }
  })
})
