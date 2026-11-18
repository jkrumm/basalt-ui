/** The pure lane and label geometry of `IntervalTrack` (Issue 2306): lanes for overlaps, and the label pass. */
import { describe, expect, test } from 'bun:test'
import { chartLabels } from '../chart-labels'
import { LABEL_SLACK, assignLanes, cutToFit, placeLaneLabels } from './interval-layout'

const SIZE = 11
const OPTS = { width: 600, size: SIZE, gap: 4 }

describe('assignLanes', () => {
  test('spans that do not overlap share a lane; an overlap takes the next', () => {
    const { lanes, count } = assignLanes([
      { start: 0, end: 10 },
      { start: 10, end: 20 },
      { start: 5, end: 15 },
      { start: 20, end: 20 },
    ])
    expect(lanes).toEqual([0, 0, 1, 0])
    expect(count).toBe(2)
  })

  test('an empty row still has one lane', () => {
    expect(assignLanes([])).toEqual({ lanes: [], count: 1 })
  })
})

describe('placeLaneLabels', () => {
  test('a label goes after its span when the plot has room there', () => {
    const marks = [{ key: 1, from: 10, to: 60 }]
    const { placed } = placeLaneLabels(
      [{ ...marks[0]!, text: 'Standup', priority: 0 }],
      marks,
      OPTS,
    )
    expect(placed).toEqual([{ key: 1, text: 'Standup', spot: 'after' }])
  })

  test('a neighbour after the span sends the label inside a span wide enough to hold it', () => {
    const marks = [
      { key: 1, from: 10, to: 300 },
      { key: 2, from: 300, to: 600 },
    ]
    const { placed } = placeLaneLabels(
      [{ ...marks[0]!, text: 'Design review', priority: 0 }],
      marks,
      OPTS,
    )
    expect(placed[0]?.spot).toBe('inside')
  })

  test('a label with no free spot is cut to the inside with an ellipsis', () => {
    const w = chartLabels.width('Architecture review', { size: SIZE })
    const marks = [
      { key: 0, from: 0, to: 40 },
      { key: 1, from: 40, to: 40 + w * 0.7 },
      { key: 2, from: 40 + w * 0.7, to: 600 },
    ]
    const { placed } = placeLaneLabels(
      [{ ...marks[1]!, text: 'Architecture review', priority: 0 }],
      marks,
      OPTS,
    )
    expect(placed[0]?.spot).toBe('inside')
    expect(placed[0]?.text.endsWith('\u2026')).toBe(true)
    expect(
      chartLabels.width(placed[0]?.text ?? '', { size: SIZE }) * LABEL_SLACK,
    ).toBeLessThanOrEqual(w * 0.7 - 8)
  })

  test('a span too narrow to cut drops its label', () => {
    const marks = [
      { key: 0, from: 0, to: 100 },
      { key: 1, from: 100, to: 112 },
      { key: 2, from: 112, to: 600 },
    ]
    const { placed, dropped } = placeLaneLabels(
      [{ ...marks[1]!, text: 'Standup', priority: 0 }],
      marks,
      OPTS,
    )
    expect(placed).toEqual([])
    expect(dropped).toEqual([1])
  })

  test('the higher priority takes the contested room, the lower drops', () => {
    // Two points 60 px apart, walled in on both sides: the room between them holds one label.
    const marks = [
      { key: 0, from: 0, to: 98 },
      { key: 1, from: 100, to: 100 },
      { key: 2, from: 160, to: 160 },
      { key: 9, from: 162, to: 600 },
    ]
    const labels = [
      { ...marks[1]!, text: 'Deploy started', priority: 1 },
      { ...marks[2]!, text: 'Rollback', priority: 5 },
    ]
    const { placed } = placeLaneLabels(labels, marks, OPTS)
    const rollback = placed.find((p) => p.key === 2)
    expect(rollback?.spot).toBe('before')
    expect(placed.find((p) => p.key === 1)).toBeUndefined()
  })

  test('no label leaves the plot', () => {
    const marks = [{ key: 1, from: 560, to: 600 }]
    const { placed } = placeLaneLabels(
      [{ ...marks[0]!, text: 'Wrap-up', priority: 0 }],
      marks,
      OPTS,
    )
    expect(placed[0]?.spot).not.toBe('after')
  })
})

describe('cutToFit', () => {
  test('keeps at least five characters, else gives up', () => {
    expect(cutToFit('Architecture review', 1, SIZE)).toBeNull()
    const cut = cutToFit(
      'Architecture review',
      chartLabels.width('Archite\u2026', { size: SIZE }) * LABEL_SLACK,
      SIZE,
    )
    expect(cut).toBe('Archite\u2026')
  })
})
