/**
 * `deriveRadius` — the radius analog of `deriveTokens`'s color knobs. Locks the law
 * (`docs/DESIGN-SPEC.md` §4) at a handful of levels, plus the throw-and-propagate validation.
 * `theme/radius.test.ts` separately locks that `RADIUS`/`RADIUS_STEP` equal `deriveRadius(0)`'s
 * output byte-for-byte — this file is the law itself, not the shipped-identity snapshot.
 */
import { describe, expect, test } from 'bun:test'
import { deriveRadius, RADIUS, RADIUS_STEP } from './palette'

describe('deriveRadius(0) reproduces the shipped identity', () => {
  test('matches RADIUS/RADIUS_STEP exactly', () => {
    expect(deriveRadius(0)).toEqual({
      card: RADIUS.card,
      ctrl: RADIUS.ctrl,
      floating: RADIUS_STEP.floating,
      tight: RADIUS_STEP.tight,
      fine: RADIUS_STEP.fine,
    })
  })

  test('card 7, ctrl 6, floating 8, tight 5, fine 4', () => {
    expect(deriveRadius(0)).toEqual({ card: 7, ctrl: 6, floating: 8, tight: 5, fine: 4 })
  })
})

describe('a positive level scales every anchor and its offsets', () => {
  test('level +2: card 9, ctrl 8, floating 10, tight 7, fine 6', () => {
    expect(deriveRadius(2)).toEqual({ card: 9, ctrl: 8, floating: 10, tight: 7, fine: 6 })
  })

  test('level +5: card 12, ctrl 11, floating 13, tight 10, fine 9', () => {
    expect(deriveRadius(5)).toEqual({ card: 12, ctrl: 11, floating: 13, tight: 10, fine: 9 })
  })
})

describe('a negative level clamps at zero instead of going negative', () => {
  test('level -5: card 2, ctrl 1, floating 3, tight 0, fine clamps to 0', () => {
    expect(deriveRadius(-5)).toEqual({ card: 2, ctrl: 1, floating: 3, tight: 0, fine: 0 })
  })

  test('level -2: card 5, ctrl 4, floating 6, tight 3, fine 2 (no clamp needed yet)', () => {
    expect(deriveRadius(-2)).toEqual({ card: 5, ctrl: 4, floating: 6, tight: 3, fine: 2 })
  })
})

describe('deriveRadius rejects a malformed level', () => {
  test('a non-integer throws', () => {
    expect(() => deriveRadius(1.5)).toThrow()
  })

  test('below -5 throws', () => {
    expect(() => deriveRadius(-6)).toThrow()
  })

  test('above 5 throws', () => {
    expect(() => deriveRadius(6)).toThrow()
  })

  test('NaN throws', () => {
    expect(() => deriveRadius(Number.NaN)).toThrow()
  })
})
