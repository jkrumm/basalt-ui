/**
 * The strip fixtures' merge functions — the folds a 288-bucket window leans on — and the
 * scenarios that must be reachable without folding.
 */
import { describe, expect, it } from 'bun:test'
import {
  buildAvailability,
  buildLink,
  buildThroughput,
  LINK_FULL_MBIT,
  mergeAvailability,
  mergeLink,
  mergeThroughput,
} from './chart-kinds-data'
import type { AvailabilitySlot, LinkSlot, ThroughputSlot } from './chart-kinds-data'

const T0 = new Date(Date.UTC(2026, 7, 20))

const avail = (lossPct: number | null, cyclesDown = 0): AvailabilitySlot => ({
  start: T0,
  lossPct,
  cycles: lossPct === null ? 0 : 10,
  cyclesDown,
})
const link = (mbit: number | null, renegotiated = false): LinkSlot => ({
  start: T0,
  mbit,
  renegotiated,
})
const flow = (down: number | null, intervals: number, skipped = 0): ThroughputSlot => ({
  start: T0,
  downBytesPerS: down,
  upBytesPerS: down === null ? null : down / 10,
  intervals,
  skipped,
  foldedFrom: 1,
  unmeasured: down === null ? 1 : 0,
})

describe('mergeAvailability', () => {
  it('takes the MAX loss, never the mean, and sums the cycles', () => {
    const merged = mergeAvailability([avail(0), avail(100, 10), avail(2)])
    expect(merged.lossPct).toBe(100)
    expect(merged.cycles).toBe(30)
    expect(merged.cyclesDown).toBe(10)
  })

  it('ignores absent buckets, and a fully absent group stays absent', () => {
    expect(mergeAvailability([avail(null), avail(3)]).lossPct).toBe(3)
    expect(mergeAvailability([avail(null), avail(null)]).lossPct).toBeNull()
  })
})

describe('mergeLink', () => {
  it('keeps the rate renegotiated TO, not the rate left', () => {
    const merged = mergeLink([link(1000), link(100, true), link(100)])
    expect(merged).toMatchObject({ mbit: 100, renegotiated: true })
    expect(mergeLink([link(100), link(1000, true)]).mbit).toBe(1000)
  })

  it('takes the slowest measured speed when nothing renegotiated', () => {
    expect(mergeLink([link(1000), link(null), link(100)])).toMatchObject({
      mbit: 100,
      renegotiated: false,
    })
  })

  it('stays absent when nothing was measured', () => {
    expect(mergeLink([link(null), link(null)]).mbit).toBeNull()
  })
})

describe('mergeThroughput', () => {
  it('weights the rate by measured intervals', () => {
    const merged = mergeThroughput([flow(1000, 30), flow(4000, 10)])
    expect(merged.downBytesPerS).toBe(1750)
    expect(merged.intervals).toBe(40)
  })

  it('counts the folded and unmeasured source buckets', () => {
    const merged = mergeThroughput([flow(1000, 20, 4), flow(null, 0), flow(1000, 20)])
    expect(merged).toMatchObject({ foldedFrom: 3, unmeasured: 1, skipped: 4 })
  })

  it('stays absent when nothing was measured', () => {
    expect(mergeThroughput([flow(null, 0), flow(null, 0)]).downBytesPerS).toBeNull()
  })
})

describe('scenarios', () => {
  it('hold a gap, an outage and a renegotiation inside the unfolded 48-bucket window', () => {
    expect(buildAvailability(48).some((s) => s.lossPct === null)).toBe(true)
    expect(buildAvailability(48).some((s) => s.cyclesDown > 0)).toBe(true)
    expect(buildLink(48).some((s) => s.renegotiated)).toBe(true)
    expect(buildLink(48).some((s) => s.mbit === null)).toBe(true)
    expect(buildThroughput(48).some((s) => s.unmeasured > 0)).toBe(true)
  })

  it('straddle the full-intensity loss: some buckets saturate, some do not', () => {
    const losses = buildAvailability(288).flatMap((s) =>
      s.lossPct !== null && s.lossPct > 0 && s.lossPct < 100 ? [s.lossPct] : [],
    )
    expect(losses.some((l) => l < 5)).toBe(true)
    expect(losses.some((l) => l > 5)).toBe(true)
  })

  it('never negotiate above the ramp top', () => {
    expect(Math.max(...buildLink(288).map((s) => s.mbit ?? 0))).toBe(LINK_FULL_MBIT)
  })
})
