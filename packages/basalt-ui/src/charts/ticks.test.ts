/** `bucketTicks` and `strideEvery`: the paths a plain minute grid never reaches (ledger row 109). */
import { describe, expect, test } from 'bun:test'
import { bucketTicks, strideEvery } from './ticks'

const at = (ms: number): Date => new Date(Date.UTC(2026, 0, 1) + ms)
const MIN = 60_000
const grid = (n: number, step = MIN, from = 13 * MIN): Date[] =>
  Array.from({ length: n }, (_, i) => at(from + i * step))

describe('strideEvery', () => {
  test('keeps every n-th value, n the smallest stride leaving at most count', () => {
    expect(strideEvery([1, 2, 3, 4, 5, 6, 7, 8, 9], 3)).toEqual([1, 4, 7])
    expect(strideEvery([1, 2], 5)).toEqual([1, 2])
  })
  test('a count of 0 or less still keeps the first value', () => {
    expect(strideEvery([1, 2, 3], 0)).toEqual([1])
  })
})

describe('bucketTicks fallbacks and guards', () => {
  test('duplicate buckets do not zero the step: ticks stay round', () => {
    const doubled = grid(60).flatMap((d) => [d, d])
    const ticks = bucketTicks(doubled, 5)
    expect(ticks.length).toBeGreaterThan(1)
    expect(ticks.every((t) => t.getUTCMinutes() % 5 === 0)).toBe(true)
  })

  test('unsorted input gives the same ticks as sorted', () => {
    const sorted = grid(60)
    expect(bucketTicks(sorted.toReversed(), 5)).toEqual(bucketTicks(sorted, 5))
  })

  test('fewer than two picks falls back to a stride over the sorted buckets', () => {
    // Two buckets a day apart: no round instant lies within a step of them but the ends.
    const two = [at(0), at(86_400_000)]
    expect(bucketTicks(two, 5)).toEqual(two)
    const sparse = grid(8, 7 * 60 * MIN)
    const ticks = bucketTicks(sparse, 3)
    expect(ticks.length).toBeGreaterThan(0)
    expect(ticks.length).toBeLessThanOrEqual(8)
    for (const t of ticks) expect(sparse.some((s) => +s === +t)).toBe(true)
  })

  test('a count of 0 or 1 still returns ticks', () => {
    expect(bucketTicks(grid(60), 0).length).toBeGreaterThan(0)
    expect(bucketTicks(grid(60), 1).length).toBeGreaterThan(0)
  })

  test('non-finite dates are dropped', () => {
    expect(
      bucketTicks([new Date(Number.NaN), ...grid(30)], 5).every((t) => !Number.isNaN(+t)),
    ).toBe(true)
  })

  test('100k buckets pick a handful of round ticks', () => {
    const ticks = bucketTicks(grid(100_000), 6)
    expect(ticks.length).toBeGreaterThan(1)
    expect(ticks.length).toBeLessThanOrEqual(12)
    expect(ticks.every((t) => t.getUTCMinutes() % 5 === 0)).toBe(true)
  })
})
