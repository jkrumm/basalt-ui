import { describe, expect, test } from 'bun:test'
import { chartMargin, VX } from './index'

describe('chartMargin', () => {
  test('a bare call deep-equals VX.margin', () => {
    expect(chartMargin()).toEqual(VX.margin)
  })

  test('{ rightAxis: true } widens right to the right-axis minimum', () => {
    expect(chartMargin({ rightAxis: true })).toEqual({
      ...VX.margin,
      right: 40,
    })
  })

  test('{ rightAxis: false } (or omitted) leaves right at VX.margin.right', () => {
    expect(chartMargin({ rightAxis: false })).toEqual(VX.margin)
  })

  test('an explicit right overrides the rightAxis-widened value', () => {
    expect(chartMargin({ rightAxis: true, right: 12 })).toEqual({
      ...VX.margin,
      right: 12,
    })
  })

  test('explicit sides override their VX.margin defaults independently', () => {
    expect(chartMargin({ top: 1, left: 2 })).toEqual({
      top: 1,
      right: VX.margin.right,
      bottom: VX.margin.bottom,
      left: 2,
    })
  })

  test('returns a new object each call', () => {
    expect(chartMargin()).not.toBe(chartMargin())
  })
})
