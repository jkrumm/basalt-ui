/**
 * S5: the engine scales replace `d3-scale` in core; `quantize` is the one d3 helper the engine
 * lacks (Heatmap's fill buckets).
 */
import { describe, expect, test } from 'bun:test'
import { quantize } from './scales'

describe('quantize', () => {
  const q = quantize([0, 10], ['a', 'b', 'c', 'd', 'e'] as const)

  test('splits the domain into equal buckets, one per range value', () => {
    expect(q(0)).toBe('a')
    expect(q(1.99)).toBe('a')
    expect(q(2)).toBe('b')
    expect(q(5)).toBe('c')
    expect(q(9.99)).toBe('e')
    expect(q(10)).toBe('e')
  })

  test('clamps outside the domain', () => {
    expect(q(-5)).toBe('a')
    expect(q(50)).toBe('e')
    expect(q(Infinity)).toBe('e')
    expect(q(-Infinity)).toBe('a')
  })

  test('a flat domain maps every value to the first bucket', () => {
    expect(quantize([3, 3], ['x', 'y'] as const)(3)).toBe('x')
  })
})
