import { describe, expect, it } from 'bun:test'
import { PACE, STAGES, labelOf, paceOf, pathOf, segmentsOf, sumOf, verdictOf } from './pace-data'

describe('paceOf', () => {
  it('reads the fixture: Build on its best split, Test running 94 s over, Deploy waiting', () => {
    expect(PACE.rows.map((r) => r.status)).toEqual(['done', 'running', 'waiting'])
    expect(PACE.committed).toBe(0)
    expect(PACE.live).toBe(94)
    expect(verdictOf(PACE)).toBe('Test is costing the most. Build matched its best split.')
    expect(sumOf(PACE)).toBe('Build 00:00 \u00b7 Test +01:34')
    expect(pathOf(PACE).projected).toBe(142 + 412 + 96)
  })

  it('names a saved stage', () => {
    const pace = paceOf(STAGES, [131], 131)
    expect(pace.live).toBe(-11)
    expect(segmentsOf(pace.rows[0]!).map((s) => s.kind)).toEqual(['base', 'saved'])
    expect(verdictOf(pace)).toBe('Build saved 00:11.')
  })

  it('keeps a zero split as a zero, with no lost or saved span', () => {
    const pace = paceOf(STAGES, [142], 142)
    const build = pace.rows[0]
    expect(build?.delta).toBe(0)
    expect(segmentsOf(build!).map((s) => s.kind)).toEqual(['base'])
    expect(labelOf(build!)).toBe('00:00')
  })

  it('has no pace before the first second', () => {
    const pace = paceOf(STAGES, [], 0)
    expect(pace.started).toBe(false)
    expect(pace.rows.every((r) => r.status === 'waiting')).toBe(true)
    expect(verdictOf(pace)).toBe('No stage has started.')
  })

  it('draws a running stage under its best split as live plus ghost', () => {
    const pace = paceOf(STAGES, [131, 300], 431 + 20)
    expect(segmentsOf(pace.rows[2]!).map((s) => s.kind)).toEqual(['live', 'ghost'])
    expect(pace.live).toBe(-11 - 18)
  })
})
