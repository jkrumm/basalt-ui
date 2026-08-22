/**
 * The type ladder's own law — the thing that decides whether a requested size gets a rung.
 *
 * This exists because the ladder is hand-tuned rather than generated, which is exactly the shape
 * that erodes: a consumer reports "no step for 20px", someone adds 20, and now 20 and 21 are the
 * same size and the guard reports a violation with two equally-correct remedies. Pinning the ratio
 * band makes the next request answerable with arithmetic instead of taste.
 */
import { describe, expect, it } from 'bun:test'
import { VX } from './index'

/** Every adjacent pair of the shipped ladder, ascending. */
const STEPS = Object.values(VX.text)
const RATIOS = STEPS.slice(1).map((size, index) => size / STEPS[index]!)

/** The band documented on `TEXT` in `tokens/index.ts`. Widen it only with a reason written there. */
const MIN_RATIO = 1.06
const MAX_RATIO = 1.17

describe('the type ladder', () => {
  it('is strictly ascending, so `Object.values` order IS the ladder order', () => {
    expect(STEPS).toEqual(STEPS.toSorted((a, b) => a - b))
    expect(new Set(STEPS).size).toBe(STEPS.length)
  })

  it('keeps every adjacent step inside the 1.06–1.17 band', () => {
    const offenders = RATIOS.map((ratio, index) => ({
      pair: `${STEPS[index]} → ${STEPS[index + 1]}`,
      ratio: Number(ratio.toFixed(3)),
    })).filter(({ ratio }) => ratio < MIN_RATIO || ratio > MAX_RATIO)

    expect(offenders).toEqual([])
  })

  it('spans the two ends consumers reported as unreachable', () => {
    // A label engraved inside a drawn object, and a numeral read at arm's length. Both arrived from
    // the same consumer round; both are roles the ladder genuinely had no step for.
    expect(VX.text.nano).toBe(10)
    expect(VX.text.display).toBe(30)
  })

  it('has no rung between xl and h2 — 21/20 = 1.05 is below the band', () => {
    // The third site from that report. `h2` is the remedy, not a waiver: it is 1px away.
    expect(STEPS.filter((size) => size > VX.text.xl && size < VX.text.h2)).toEqual([])
    expect(VX.text.h2 / 20).toBeLessThan(MIN_RATIO)
  })

  it('pins the iOS input floor, which is a rung with an external constraint', () => {
    expect(VX.text.lg).toBe(16)
  })
})
