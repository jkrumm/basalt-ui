/**
 * Expression cycle 14 (`v3-expr-14-kit-fixes` 1): a rule caption keeps clear of a dense line. When a line fills
 * both ends of its rule the caption slides along the rule to the stretch the line leaves free, and it keeps
 * its place beside the rule instead of stepping off it (cycle 14 probe: a caption 150 px from its rule).
 */
import { describe, expect, test } from 'bun:test'
import { placeRefLabel, yRangeWithin } from './ref-label'
import type { RefLabelPoint } from './ref-label'

const PLOT = { plotWidth: 300, plotHeight: 160, domain: [0, 100] as const, fontSize: 11 }

/** A line that sits on the rule (value 50) at both ends and drops far below it in the middle. */
const bridge: RefLabelPoint[] = Array.from({ length: 60 }, (_, i) => {
  const fx = i / 59
  return { fx, y: fx > 0.3 && fx < 0.7 ? 5 : 50 + 3 * Math.sin(i) }
})

const place = (series: RefLabelPoint[]) =>
  placeRefLabel({
    pinned: undefined,
    startFirst: false,
    value: 50,
    label: '50',
    series: [series],
    ...PLOT,
  })

describe('a rule caption beside a line that fills its ends', () => {
  test('slides along the rule to the stretch the line leaves free', () => {
    const placed = place(bridge)
    expect(placed).not.toBeNull()
    expect(placed!.shift).toBe(0)
    expect(placed!.slide).toBeGreaterThan(0)
    const range = yRangeWithin(bridge, placed!.box.fx0, placed!.box.fx1)
    expect(range === null || range[1] < placed!.box.y0 || range[0] > placed!.box.y1).toBe(true)
  })
})
