import { describe, expect, test } from 'bun:test'
import { checkShards, shardFiles } from './check-layout-shards'

const log = (files: number) => ` 100 pass\n 0 fail\nRan 100 tests across ${files} files. [41.00s]\n`

describe('shardFiles', () => {
  test('reads the file count of the summary line', () => {
    expect(shardFiles(log(22))).toBe(22)
    expect(shardFiles('Ran 1 test across 1 file.')).toBe(1)
  })
  test('is null without a summary line', () => {
    expect(shardFiles('error: browser launch failed')).toBeNull()
  })
})

describe('checkShards', () => {
  test('passes when the shards add up to the suite', () => {
    expect(checkShards([log(22), log(21), log(21), log(21)], 4, 85).ok).toBe(true)
  })
  test('fails when a shard ran less than its share', () => {
    const r = checkShards([log(22), log(21), log(20), log(21)], 4, 85)
    expect(r.ok).toBe(false)
    expect(r.message).toContain('84')
  })
  test('fails on a missing shard log or a log with no summary', () => {
    expect(checkShards([log(85)], 4, 85).ok).toBe(false)
    expect(checkShards([log(22), log(21), 'crashed', log(21)], 4, 64).ok).toBe(false)
  })
})
