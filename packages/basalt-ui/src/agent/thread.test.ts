import { describe, expect, test } from 'bun:test'
import { isLiveStatus } from './thread'
import type { StreamStatus } from './thread'

describe('isLiveStatus', () => {
  test.each<[StreamStatus | undefined, boolean]>([
    ['submitted', true],
    ['streaming', true],
    ['idle', false],
    ['done', false],
    ['error', false],
    [undefined, false],
  ])('%s -> %p', (status, live) => {
    expect(isLiveStatus(status)).toBe(live)
  })
})
