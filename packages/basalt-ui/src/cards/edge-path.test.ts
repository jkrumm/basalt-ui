import { describe, expect, test } from 'bun:test'
import { elbowPath, hop } from './edge-path'

const LEAD = { lead: 24, radius: 12 }

describe('elbowPath', () => {
  test('a target ahead and level is one straight line, right side to left side', () => {
    const { path, end } = elbowPath(
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 180, y: 0, width: 100, height: 40 },
      LEAD,
    )
    expect(path).toBe('M 100 20 H 180')
    expect(end).toEqual({ x: 180, y: 20 })
  })

  test('a target ahead and lower runs out by the lead, turns twice on the radius and ends on its left middle', () => {
    const { path, end } = elbowPath(
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 180, y: 100, width: 100, height: 36 },
      LEAD,
    )
    expect(path).toBe('M 100 20 H 112 A 12 12 0 0 1 124 32 V 106 A 12 12 0 0 0 136 118 H 180')
    expect(end).toEqual({ x: 180, y: 118 })
  })

  test('a target ahead and higher turns the other way', () => {
    const { path } = elbowPath(
      { x: 0, y: 100, width: 100, height: 40 },
      { x: 180, y: 0, width: 100, height: 40 },
      LEAD,
    )
    expect(path).toBe('M 100 120 H 112 A 12 12 0 0 0 124 108 V 32 A 12 12 0 0 1 136 20 H 180')
  })

  test('a short drop takes a smaller radius', () => {
    const { path } = elbowPath(
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 180, y: 10, width: 100, height: 40 },
      LEAD,
    )
    expect(path).toBe('M 100 20 H 119 A 5 5 0 0 1 124 25 V 25 A 5 5 0 0 0 129 30 H 180')
  })

  test('a target in the same column loops out on the right and enters its right side', () => {
    const { path, end } = elbowPath(
      { x: 0, y: 0, width: 100, height: 40 },
      { x: 0, y: 100, width: 100, height: 40 },
      LEAD,
    )
    expect(end).toEqual({ x: 100, y: 120 })
    expect(path).toBe('M 100 20 H 112 A 12 12 0 0 1 124 32 V 108 A 12 12 0 0 1 112 120 H 100')
  })
})

describe('hop', () => {
  test('level ends are a line, others one cubic across the gap', () => {
    expect(hop(0, 10, 64, 10)).toBe(' L 64 10')
    expect(hop(0, 10, 64, 50)).toBe(' C 32 10 32 50 64 50')
  })
})
