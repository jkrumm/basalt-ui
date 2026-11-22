/**
 * Issue 2911 (b): in a crowded cloud a page label no spot beside its anchor can hold goes to the
 * nearest clear box a ring away, joined by a leader; where no clear box lies within reach it keeps the
 * fewest-dots spot and asks the host for a surface plate under its text.
 */
import { describe, expect, test } from 'bun:test'
import { chartLabels } from './chart-labels'
import type { LabelBox } from './chart-labels'

const FRAME = { width: 300, height: 200 }
const dot = (x: number, y: number): LabelBox => ({ left: x - 4, top: y - 4, width: 8, height: 8 })
/** A block of dots over a corner of the frame, spaced so that no label fits between them. */
const cloud = (x0: number, y0: number, x1: number, y1: number): LabelBox[] =>
  Array.from({ length: Math.ceil((x1 - x0) / 9) * Math.ceil((y1 - y0) / 9) }, (_, i) => {
    const cols = Math.ceil((x1 - x0) / 9)
    return dot(x0 + (i % cols) * 9, y0 + Math.floor(i / cols) * 9)
  })

describe('a label in a crowded cloud', () => {
  test('takes a clear box a ring away, with a leader back to its anchor', () => {
    const obstacles = cloud(120, 70, 200, 130)
    const { placed, dropped } = chartLabels.place(
      [{ key: 'a', text: 'Legit vs marketing', x: 160, y: 100 }],
      FRAME,
      { obstacles },
    )
    expect(dropped).toEqual([])
    const [label] = placed
    expect(label?.leader).toBeDefined()
    const box = label as LabelBox
    expect(
      obstacles.filter(
        (o) =>
          o.left < box.left + box.width &&
          box.left < o.left + o.width &&
          o.top < box.top + box.height &&
          box.top < o.top + o.height,
      ),
    ).toEqual([])
    expect(label?.leader?.from).toEqual({ x: 160, y: 100 })
  })

  test('a label with room beside its anchor has no leader', () => {
    const { placed } = chartLabels.place([{ key: 'a', text: 'Spam', x: 40, y: 100 }], FRAME, {
      obstacles: [dot(40, 100)],
    })
    expect(placed[0]?.leader).toBeUndefined()
  })
})
