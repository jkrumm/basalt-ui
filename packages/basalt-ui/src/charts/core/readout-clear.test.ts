/**
 * The cross-axis corner of the hover readout: the y chip at the plot's bottom hangs over the x axis'
 * first tick, the x chip at the plot's left edge over the y gutter's lowest tick; each is blanked
 * only while its chip sits in the corner.
 */
import { describe, expect, test } from 'bun:test'
import type { ChartValue } from '@tanstack/charts/types/core'
import { xTickOpacity, yTickOpacity } from './readout-clear'
import type { Corner, ReadoutFocus } from './readout-clear'

/** x over 0..100, y over 0..200. */
const corner: Corner = {
  x: (v) => (typeof v === 'number' ? v / 100 : null),
  y: (v) => (typeof v === 'number' ? v / 200 : null),
}

const focus = (xValue: number, yValue: number): ReadoutFocus => ({
  primary: { x: 200 + xValue, y: 100 - yValue / 4, xValue, yValue },
})

const xOpacity = xTickOpacity({
  tick: { text: String, anchor: () => 'start', dx: () => undefined },
  readoutText: String,
  fontSize: 11,
  width: 400,
  corner,
})
const yOpacity = yTickOpacity({ fontSize: 11, chip: true, corner })
const xAt = (value: number, f: ReadoutFocus): number =>
  xOpacity({ value, position: 10 + value * 3, focus: f })
const yAt = (value: number, f: ReadoutFocus): number =>
  yOpacity({ value: value as ChartValue, position: 200 - value, focus: f })

describe('the y chip at the plot bottom blanks the first x tick', () => {
  test('first tick, focus at the floor: blanked', () => expect(xAt(0, focus(60, 2))).toBe(0))
  test('first tick, focus mid-height: kept', () => expect(xAt(0, focus(60, 100))).toBe(1))
  test('a tick far from the left edge: kept', () => expect(xAt(50, focus(80, 2))).toBe(1))
  test('no focus: kept', () => expect(xAt(0, null)).toBe(1))
})

describe('the x chip at the plot left edge blanks the lowest y tick', () => {
  test('lowest tick, focus at the left edge: blanked', () => expect(yAt(0, focus(2, 120))).toBe(0))
  test('lowest tick, focus away from the edge: kept', () => expect(yAt(0, focus(50, 120))).toBe(1))
  test('a higher tick, focus at the left edge: kept', () => expect(yAt(150, focus(2, 40))).toBe(1))
})

describe('a chart that draws no x chip keeps its lowest y tick', () => {
  const silent = yTickOpacity({
    fontSize: 11,
    chip: true,
    corner: { ...corner, xChip: () => false },
  })
  test('focus at the left edge, no x chip: kept', () =>
    expect(silent({ value: 0, position: 200, focus: focus(2, 120) })).toBe(1))
})

describe('without a corner the ticks only follow their own chip', () => {
  const plain = yTickOpacity({ fontSize: 11, chip: true })
  test('the tick on the chip row is blanked', () => {
    const f = focus(50, 100)
    expect(plain({ value: 100, position: f?.primary.y ?? 0, focus: f })).toBe(0)
  })
  test('a tick off the chip row is kept', () => {
    expect(plain({ value: 0, position: 200, focus: focus(2, 120) })).toBe(1)
  })
})

describe('a label inside the plot is blanked by its own row, not its line', () => {
  const inside = yTickOpacity({ fontSize: 11, chip: true, shift: () => 11 })
  const f = focus(50, 100)
  const row = f?.primary.y ?? 0
  test('the chip 11 px below the line: the label under it is blanked', () => {
    expect(inside({ value: 100, position: row - 11, focus: f })).toBe(0)
  })
  test('the line itself, whose label stands 11 px off the chip row: kept', () => {
    expect(inside({ value: 100, position: row - 40, focus: f })).toBe(1)
  })
})
