/**
 * `ramps.ts` carries the 2.x `BP` families hex-identical (tokens-visual 3.8), so no argo/rb series
 * colour shifts when `BP` and `p()` are deleted. This pins every hex and `p()`'s default steps
 * against `palette.ts` until that module goes.
 */
import { describe, expect, test } from 'bun:test'
import { BP, p } from './palette'
import { RAMPS, rampPair } from './ramps'
import type { RampHue } from './ramps'

describe('ramps', () => {
  test('every family is hex-identical to the 2.x BP ramp it was carried from', () => {
    const grey = new Set(['black', 'white'])
    const carried = Object.keys(BP).filter((key) => !grey.has(key))
    expect(Object.keys(RAMPS).sort()).toEqual(carried.sort())
    for (const hue of Object.keys(RAMPS) as RampHue[]) {
      expect([...RAMPS[hue]] as string[]).toEqual([...BP[hue as keyof typeof BP]] as string[])
    }
  })

  test('rampPair defaults to p()`s light 2 / dark 3 and takes explicit steps', () => {
    for (const hue of Object.keys(RAMPS) as RampHue[]) {
      expect(rampPair(hue)).toEqual(p(BP[hue as keyof typeof BP] as readonly string[]))
    }
    expect(rampPair('blue', { light: 3, dark: 4 })).toEqual(p(BP.blue, 3, 4))
  })

  test('every family has five steps', () => {
    for (const ramp of Object.values(RAMPS)) expect(ramp).toHaveLength(5)
  })
})
