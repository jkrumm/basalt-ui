import { describe, expect, test } from 'bun:test'
import { VX } from '../../tokens'
import { maxTextWidth } from '../utils/measure-text'
import { autoMargin, probeAxisLabels } from './auto-margin'
import { logTickValues, niceLogDomain } from './log-ticks'

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

  test('a ROTATED x label with no right axis reserves only the floor — nothing overhangs right', () => {
    // Rotated labels anchor at their right edge and hang LEFT of their tick (rotatedLeftOverhang),
    // so the last tick's label costs the right gutter nothing, unlike the unrotated half-width case.
    const m = autoMargin({ bottom: ['2026-08-18T12:00'], rotate: 45 })
    expect(m.right).toBe(VX.margin.right)
  })

  test('a right axis still widens the right gutter even when the x labels are rotated', () => {
    const m = autoMargin({ right: ['$1,000.00'], bottom: ['2026-08-18T12:00'], rotate: 45 })
    expect(m.right).toBeGreaterThan(VX.margin.right)
  })
})

describe('probeAxisLabels — scale: log', () => {
  const format = (v: number) => `$${v}`

  test('measures through logTickValues — the exact helper the axis paints from', () => {
    const domain: [number, number] = [16, 80000]
    const { labels } = probeAxisLabels({ domain, ticks: 5, scale: 'log', format })
    expect(labels).toEqual(logTickValues(domain, 5).map(format))
  })

  test('nice rounds the domain outward before measuring, mirroring the real niced scale', () => {
    const domain: [number, number] = [16, 80000]
    const { labels } = probeAxisLabels({ domain, ticks: 5, scale: 'log', nice: true, format })
    expect(labels).toEqual(logTickValues(niceLogDomain(domain), 5).map(format))
  })

  test('with no explicit format, defaults to the same grouped style the linear axis uses', () => {
    const domain: [number, number] = [10000, 100000]
    const { labels, format: resolved } = probeAxisLabels({ domain, ticks: 5, scale: 'log' })
    expect(labels).toEqual(['10,000', '20,000', '50,000', '100,000'])
    expect(resolved(100000)).toBe('100,000')
  })

  test('the grouped default matches the linear axis default for the same round magnitude', () => {
    const linear = probeAxisLabels({ domain: [0, 100000], ticks: 5 })
    const log = probeAxisLabels({ domain: [10000, 100000], ticks: 5, scale: 'log' })
    expect(log.format(100000)).toBe(linear.format(100000))
  })

  test('the grouped default keeps sub-unit digits instead of truncating to "0"', () => {
    const { format: resolved } = probeAxisLabels({ domain: [1e-8, 1e-6], ticks: 5, scale: 'log' })
    expect(resolved(1e-7)).not.toBe('0')
  })
})

describe('autoMargin — a ROTATED x label reaches into the LEFT gutter', () => {
  const bottom = ['Mar 01 14:00', 'Mar 02 14:00']

  test('45° widens left past the token floor — the first label hangs off the plot otherwise', () => {
    const flat = autoMargin({ bottom })
    const tilted = autoMargin({ bottom, rotate: 45 })
    expect(tilted.left).toBeGreaterThan(flat.left)
    expect(tilted.left).toBeGreaterThan(VX.margin.left)
  })

  test('the widening IS the measured projection — width × cos(45°)', () => {
    const width = maxTextWidth(bottom, VX.axisFont)
    expect(autoMargin({ bottom, rotate: 45 }).left).toBe(
      Math.ceil(Math.max(VX.margin.left, width * Math.cos(Math.PI / 4))),
    )
  })

  test('90° costs NO horizontal room — the string runs straight down from its tick', () => {
    expect(autoMargin({ bottom, rotate: 90 }).left).toBe(autoMargin({ bottom }).left)
  })

  test('an unrotated axis is untouched, and a left axis still wins when it is wider', () => {
    expect(autoMargin({ bottom }).left).toBe(VX.margin.left)
    const withAxis = autoMargin({ left: ['1,000,000,000'], bottom, rotate: 45 })
    expect(withAxis.left).toBeGreaterThanOrEqual(autoMargin({ bottom, rotate: 45 }).left)
  })
})
