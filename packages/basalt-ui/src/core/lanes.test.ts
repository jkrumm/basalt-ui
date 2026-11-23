import { describe, expect, test } from 'bun:test'
import { packLanes } from './lanes'

describe('packLanes', () => {
  test('a span that overlaps nothing keeps the whole width', () => {
    expect(
      packLanes([
        { start: 0, end: 60 },
        { start: 60, end: 90 },
      ]),
    ).toEqual([
      { lane: 0, lanes: 1 },
      { lane: 0, lanes: 1 },
    ])
  })

  test('overlapping spans stand side by side, and a chain is one cluster', () => {
    const packed = packLanes([
      { start: 0, end: 60 },
      { start: 30, end: 90 },
      { start: 75, end: 120 },
      { start: 200, end: 230 },
    ])
    expect(packed).toEqual([
      { lane: 0, lanes: 2 },
      { lane: 1, lanes: 2 },
      { lane: 0, lanes: 2 },
      { lane: 0, lanes: 1 },
    ])
  })

  test('no two spans of one cluster share a lane while they overlap', () => {
    const items = [
      { start: 10, end: 50 },
      { start: 0, end: 100 },
      { start: 20, end: 40 },
      { start: 45, end: 70 },
    ]
    const packed = packLanes(items)
    for (let a = 0; a < items.length; a++)
      for (let b = a + 1; b < items.length; b++) {
        const p = items[a] as { start: number; end: number }
        const q = items[b] as { start: number; end: number }
        if (p.start < q.end && q.start < p.end) expect(packed[a]?.lane).not.toBe(packed[b]?.lane)
      }
    expect(packed.every((p) => p.lane < p.lanes)).toBe(true)
  })

  test('the empty list packs to nothing', () => {
    expect(packLanes([])).toEqual([])
  })
})
