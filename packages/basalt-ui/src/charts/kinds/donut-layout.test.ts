import { describe, expect, test } from 'bun:test'
import {
  foldOther,
  resolveDonutLayout,
  resolveDonutRadius,
  resolveOtherKey,
  sharePercent,
} from './donut-layout'

const slices = (n: number) => Array.from({ length: n }, (_, i) => ({ key: `k${i}`, value: i + 1 }))

describe('resolveDonutLayout', () => {
  test('side legend strictly above 1.5 aspect', () => {
    expect(resolveDonutLayout({ frameW: 600, frameH: 400, containerClass: 'wide' }).side).toBe(
      false,
    )
    expect(resolveDonutLayout({ frameW: 601, frameH: 400, containerClass: 'wide' }).side).toBe(true)
  })
  test('compact and micro always stack', () => {
    expect(resolveDonutLayout({ frameW: 900, frameH: 100, containerClass: 'compact' }).side).toBe(
      false,
    )
    expect(resolveDonutLayout({ frameW: 900, frameH: 100, containerClass: 'micro' }).side).toBe(
      false,
    )
  })
  test('an already-side layout holds until W/H drops below 1.35', () => {
    const at = (frameW: number, wasSide: boolean) =>
      resolveDonutLayout({ frameW, frameH: 400, containerClass: 'wide', wasSide }).side
    expect(at(560, true)).toBe(true)
    expect(at(560, false)).toBe(false)
    expect(at(530, true)).toBe(false)
  })
  test('unmeasured height stacks', () => {
    expect(resolveDonutLayout({ frameW: 900, frameH: 0, containerClass: 'wide' }).side).toBe(false)
  })
})

describe('resolveDonutRadius', () => {
  test('side ring = min(h, 0.55w)', () => {
    expect(resolveDonutRadius({ plotW: 500, plotH: 200, frameW: 800, side: true })).toBe(96)
    expect(resolveDonutRadius({ plotW: 500, plotH: 300, frameW: 400, side: true })).toBeCloseTo(106)
  })
  test('side ring is never wider than the plot', () => {
    expect(resolveDonutRadius({ plotW: 100, plotH: 300, frameW: 800, side: true })).toBe(46)
  })
  test('a tiny plot never yields a negative radius', () => {
    expect(resolveDonutRadius({ plotW: 4, plotH: 300, frameW: 800, side: true })).toBe(0)
    expect(resolveDonutRadius({ plotW: 0, plotH: 0, frameW: 0, side: false })).toBe(0)
  })
  test('stacked ring fills the shorter side', () => {
    expect(resolveDonutRadius({ plotW: 300, plotH: 200, frameW: 300, side: false })).toBe(96)
  })
})

describe('foldOther', () => {
  test('6 slices pass through', () => {
    expect(foldOther(slices(6))).toEqual({ kept: slices(6), other: null })
  })
  test('7 slices fold the smallest into Other', () => {
    const { kept, other } = foldOther(slices(7))
    expect(kept.map((s) => s.key)).toEqual(['k1', 'k2', 'k3', 'k4', 'k5', 'k6'])
    expect(other).toBe(1)
  })
  test('8 slices fold the two smallest', () => {
    const { kept, other } = foldOther(slices(8))
    expect(kept).toHaveLength(6)
    expect(other).toBe(1 + 2)
  })
})

describe('foldOther — bad values', () => {
  test('non-finite and negative values count as 0', () => {
    const { kept, other } = foldOther([
      ...slices(6),
      { key: 'nan', value: Number.NaN },
      { key: 'neg', value: -5 },
    ])
    expect(kept.every((s) => Number.isFinite(s.value) && s.value >= 0)).toBe(true)
    expect(other).toBe(0)
  })
})

describe('resolveOtherKey', () => {
  test('is __other unless an input key already uses it', () => {
    expect(resolveOtherKey(['a'])).toBe('__other')
    expect(resolveOtherKey(['__other'])).toBe('___other')
  })
})

describe('sharePercent', () => {
  test('rounds to a whole percent; total 0 is 0%', () => {
    expect(sharePercent(1, 3)).toBe(33)
    expect(sharePercent(5, 0)).toBe(0)
  })
})
