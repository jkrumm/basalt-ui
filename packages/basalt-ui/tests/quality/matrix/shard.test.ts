import { describe, expect, test } from 'bun:test'
import { inShard, parseShard, shardLine } from './shard'

describe('parseShard', () => {
  test('reads i/n; unset and empty mean the whole matrix', () => {
    expect(parseShard('2/5')).toEqual({ index: 2, count: 5 })
    expect(parseShard(undefined)).toBeNull()
    expect(parseShard('')).toBeNull()
  })
  test('throws on a malformed or out-of-range value', () => {
    for (const bad of ['0/4', '5/4', '2', 'a/b', '1/0', '1/4/4']) {
      expect(() => parseShard(bad), bad).toThrow('BASALT_MATRIX_SHARD')
    }
  })
})

describe('inShard', () => {
  const items = Array.from({ length: 23 }, (_, i) => i)
  test('the shards are disjoint and together hold every item once', () => {
    for (const count of [1, 2, 4, 5, 7, 30]) {
      const all = Array.from({ length: count }, (_, i) =>
        inShard(items, { index: i + 1, count }),
      ).flat()
      expect(all.toSorted((a, b) => a - b)).toEqual(items)
    }
  })
  test('without a shard it keeps everything', () => {
    expect(inShard(items, null)).toEqual(items)
  })
  test('shard sizes differ by at most one', () => {
    const sizes = [1, 2, 3, 4, 5].map((index) => inShard(items, { index, count: 5 }).length)
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
  })
})

describe('shardLine', () => {
  test('names the shard, the cells it ran and the cells the matrix has', () => {
    expect(shardLine({ index: 3, count: 5 }, 40, 200)).toBe('matrix-shard 3/5 ran=40 total=200')
    expect(shardLine(null, 200, 200)).toBe('matrix-shard 1/1 ran=200 total=200')
  })
})
