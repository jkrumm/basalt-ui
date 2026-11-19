/**
 * Expression cycle 11 (`v3-expr-11-kit-fixes` 5): a vertical rule's caption claims its rule too, so
 * the reference and zone captions placed after it keep off the rule as well as off its caption.
 */
import { describe, expect, test } from 'bun:test'
import { xRefLabelBoxes, xRefLabelSpots } from './axis-gaps'

describe('a vertical rule is a box for the captions placed after it', () => {
  const plotWidth = 700
  const spots = xRefLabelSpots({
    lines: [{ x: 0.95, label: 'Limit', color: 'currentColor' }],
    fraction: (x) => x as number,
    plotWidth,
    fontSize: 11,
  })

  test('the rule spans the plot top to bottom at its x, a thin box beside its caption', () => {
    const boxes = xRefLabelBoxes(spots, { plotWidth, fontSize: 11 })
    const rule = boxes.find((b) => b.top === 0)
    const x = 0.95 * plotWidth
    expect(boxes).toHaveLength(2)
    expect(rule).toBeDefined()
    expect(rule!.fx0 * plotWidth).toBeLessThan(x)
    expect(rule!.fx1 * plotWidth).toBeGreaterThan(x)
    expect((rule!.fx1 - rule!.fx0) * plotWidth).toBeLessThan(8)
    expect(rule!.bottom).toBeGreaterThan(2000)
  })

  test('the caption box itself is still there, clear of the rule box', () => {
    const [caption, rule] = xRefLabelBoxes(spots, { plotWidth, fontSize: 11 })
    expect(caption).toBeDefined()
    expect(rule).toBeDefined()
    expect(caption!.fx1).toBeLessThanOrEqual(rule!.fx0)
  })
})
