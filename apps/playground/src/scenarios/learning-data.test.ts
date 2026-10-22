/**
 * S5 fixture invariants: the figures the page states must agree with the journal.
 */
import { describe, expect, it } from 'bun:test'
import { ITEM_TIMELINE, ITEM_TIMELINE_TOTAL, TODAY } from './agents-data'
import {
  FIRST_DATE,
  JOURNAL,
  LAST_DATE,
  LAST_SESSIONS,
  LEARNING_TODAY,
  MEAN_RATING,
  MINUTES_THIS_MONTH,
  PARTNER_COUNT,
  SESSIONS_LOGGED,
  fmtMinutes,
  fmtSince,
} from './learning-data'

describe('learning-data', () => {
  it('has 320 entries, past the EventList virtualisation threshold', () => {
    expect(JOURNAL).toHaveLength(320)
    expect(SESSIONS_LOGGED).toBe(320)
  })

  it('runs newest first, ids descending, ending on or before the reading date', () => {
    for (const [i, e] of JOURNAL.entries()) {
      const prev = JOURNAL[i - 1]
      if (!prev) continue
      expect(e.date <= prev.date).toBe(true)
      expect(e.id).toBeLessThan(prev.id)
      if (e.date === prev.date && e.time !== undefined && prev.time !== undefined) {
        expect(e.time <= prev.time).toBe(true)
      }
    }
    expect(LAST_DATE <= LEARNING_TODAY.toISOString().slice(0, 10)).toBe(true)
  })

  it('spans about fourteen months with several sessions on some days and gaps between others', () => {
    const months = (Date.parse(LAST_DATE) - Date.parse(FIRST_DATE)) / (30.4 * 86_400_000)
    expect(months).toBeGreaterThan(12)
    expect(months).toBeLessThan(16)
    const days = new Set(JOURNAL.map((e) => e.date))
    expect(days.size).toBeLessThan(JOURNAL.length)
  })

  it('is deterministic and shaped like rb: ratings 1–5 or null, positive durations', () => {
    for (const e of JOURNAL) {
      expect(e.rating === null || (e.rating >= 1 && e.rating <= 5)).toBe(true)
      expect(e.durationMin).toBeGreaterThan(0)
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    }
    expect(JOURNAL.some((e) => e.time === undefined)).toBe(true)
    expect(JOURNAL.some((e) => e.time !== undefined)).toBe(true)
    expect(JOURNAL.some((e) => e.partnerLabel === null)).toBe(true)
  })

  it('the strip figures match the data', () => {
    const ratings = JOURNAL.flatMap((e) => (e.rating === null ? [] : [e.rating]))
    expect(MEAN_RATING).toBeCloseTo(ratings.reduce((a, b) => a + b, 0) / ratings.length, 9)
    const october = JOURNAL.filter((e) => e.date.startsWith('2026-10'))
    expect(MINUTES_THIS_MONTH).toBe(october.reduce((a, e) => a + e.durationMin, 0))
    expect(PARTNER_COUNT).toBe(new Set(JOURNAL.map((e) => e.partnerLabel).filter(Boolean)).size)
    expect(LAST_DATE).toBe(JOURNAL[0]?.date ?? '')
    expect(FIRST_DATE).toBe(JOURNAL.at(-1)?.date ?? '')
  })

  it('the short slice is the last five sessions', () => {
    expect(LAST_SESSIONS).toEqual(JOURNAL.slice(0, 5))
  })

  it('formats minutes and recency', () => {
    expect(fmtMinutes(45)).toBe('45 min')
    expect(fmtMinutes(120)).toBe('2 h')
    expect(fmtMinutes(200)).toBe('3 h 20 min')
    expect(fmtSince(0)).toBe('today')
    expect(fmtSince(1)).toBe('yesterday')
    expect(fmtSince(5)).toBe('5 days ago')
  })
})

describe('S3 item timeline fixture', () => {
  it('has 45 events, oldest first, over about five days before the reading date', () => {
    expect(ITEM_TIMELINE).toHaveLength(45)
    expect(ITEM_TIMELINE_TOTAL).toBeGreaterThan(ITEM_TIMELINE.length)
    for (const [i, e] of ITEM_TIMELINE.entries()) {
      const prev = ITEM_TIMELINE[i - 1]
      if (prev) expect(e.at.getTime()).toBeGreaterThanOrEqual(prev.at.getTime())
      expect(e.at.getTime()).toBeLessThan(TODAY.getTime())
    }
    const first = ITEM_TIMELINE[0]
    const last = ITEM_TIMELINE.at(-1)
    const days = ((last?.at.getTime() ?? 0) - (first?.at.getTime() ?? 0)) / 86_400_000
    expect(days).toBeGreaterThan(4)
    expect(days).toBeLessThan(6)
  })

  it('mixes transitions, dispatches and operations with unique ids', () => {
    expect(new Set(ITEM_TIMELINE.map((e) => e.kind))).toEqual(
      new Set(['transition', 'dispatch', 'operation']),
    )
    expect(new Set(ITEM_TIMELINE.map((e) => e.id)).size).toBe(ITEM_TIMELINE.length)
  })

  it('chains the state transitions and ends in awaiting, 30 h before the reading date', () => {
    const transitions = ITEM_TIMELINE.flatMap((e) => (e.kind === 'transition' ? [e] : []))
    for (const [i, t] of transitions.entries()) {
      const prev = transitions[i - 1]
      if (prev) expect(t.from).toBe(prev.to)
    }
    const last = transitions.at(-1)
    expect(last?.to).toBe('awaiting')
    expect((TODAY.getTime() - (last?.at.getTime() ?? 0)) / 3_600_000).toBe(30)
  })

  it('a merged dispatch carries its merge time, after its creation', () => {
    const dispatches = ITEM_TIMELINE.flatMap((e) => (e.kind === 'dispatch' ? [e] : []))
    for (const d of dispatches) {
      expect(d.status === 'merged').toBe(d.mergedAt !== undefined)
      if (d.mergedAt) expect(d.mergedAt.getTime()).toBeGreaterThan(d.at.getTime())
    }
  })
})
