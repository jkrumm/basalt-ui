import { describe, expect, test } from 'bun:test'
import { checkShards, parseShardLog } from './check-matrix-shards'

const log = (index: number, count: number, ran: number, total: number, files = 6) =>
  ` ${ran} pass\n 0 fail\nmatrix-shard ${index}/${count} ran=${ran} total=${total}\nRan ${ran} tests across ${files} files. [41.00s]\n`

const good = [log(1, 4, 51, 200), log(2, 4, 50, 200), log(3, 4, 50, 200), log(4, 4, 49, 200)]

describe('parseShardLog', () => {
  test('reads the shard line and the file count', () => {
    expect(parseShardLog(log(2, 4, 50, 200))).toEqual({
      index: 2,
      count: 4,
      ran: 50,
      total: 200,
      files: 6,
    })
  })
  test('is null without the summary or without the shard line', () => {
    expect(parseShardLog('error: browser launch failed')).toBeNull()
    expect(parseShardLog('Ran 5 tests across 6 files.')).toBeNull()
  })
})

describe('checkShards', () => {
  test('passes when the shards add up to the matrix', () => {
    expect(checkShards(good, 4, 6).ok).toBe(true)
  })
  test('fails when a shard ran less than its share', () => {
    const r = checkShards([good[0]!, good[1]!, log(3, 4, 40, 200), good[3]!], 4, 6)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('190')
  })
  test('fails on a missing shard log, a crashed shard or a repeated index', () => {
    expect(checkShards(good.slice(1), 4, 6).ok).toBe(false)
    expect(checkShards([good[0]!, good[1]!, 'crashed', good[3]!], 4, 6).ok).toBe(false)
    expect(checkShards([good[0]!, good[1]!, good[1]!, good[3]!], 4, 6).ok).toBe(false)
  })
  test('fails when a shard ran fewer files than the matrix has', () => {
    const r = checkShards([good[0]!, log(2, 4, 50, 200, 5), good[2]!, good[3]!], 4, 6)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('files')
  })
  test('fails when the shards disagree on the cell count or were cut for another n', () => {
    expect(checkShards([good[0]!, log(2, 4, 50, 199), good[2]!, good[3]!], 4, 6).ok).toBe(false)
    expect(checkShards(good, 5, 6).ok).toBe(false)
    expect(
      checkShards(
        good.map((_, i) => log(i + 1, 3, 1, 4)),
        4,
        6,
      ).ok,
    ).toBe(false)
  })
})
