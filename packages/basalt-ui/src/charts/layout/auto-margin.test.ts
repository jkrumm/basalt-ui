import { describe, expect, test } from 'bun:test'
import { VX } from '../../tokens'
import { autoMargin } from './auto-margin'

describe('autoMargin', () => {
  test('never goes below the VX.margin floor', () => {
    const m = autoMargin()
    expect(m.top).toBe(VX.margin.top)
    expect(m.right).toBeGreaterThanOrEqual(VX.margin.right)
    expect(m.bottom).toBeGreaterThanOrEqual(VX.margin.bottom)
    expect(m.left).toBeGreaterThanOrEqual(VX.margin.left)
  })

  test('a wide left label widens the left gutter', () => {
    const narrow = autoMargin({ left: ['0', '5'] })
    const wide = autoMargin({ left: ['0', '1,250,000'] })
    expect(wide.left).toBeGreaterThan(narrow.left)
  })

  test('right-axis labels widen the right gutter past the floor', () => {
    const m = autoMargin({ right: ['$1,000.00'] })
    expect(m.right).toBeGreaterThan(VX.margin.right)
  })

  test('without a right axis, the right gutter still reserves half the widest x label', () => {
    // The last x tick is centred on the plot's right edge, so half its label hangs past it.
    const m = autoMargin({ bottom: ['2026-08-18T12:00'] })
    expect(m.right).toBeGreaterThan(VX.margin.right)
  })

  test('rotated x labels deepen the bottom gutter', () => {
    const flat = autoMargin({ bottom: ['a long category label'] })
    const rotated = autoMargin({ bottom: ['a long category label'], rotate: 45 })
    expect(rotated.bottom).toBeGreaterThan(flat.bottom)
  })

  test('an explicit override wins over measurement', () => {
    const m = autoMargin({ left: ['1,250,000'], override: { left: 4, top: 0 } })
    expect(m.left).toBe(4)
    expect(m.top).toBe(0)
  })
})
