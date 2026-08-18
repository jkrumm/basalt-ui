import { describe, expect, test } from 'bun:test'
import { maxTextWidth, measureText, resetTextMetrics } from './measure-text'

describe('measureText', () => {
  test('width grows with the string and with the font size', () => {
    resetTextMetrics()
    expect(measureText('1,250,000', 11)).toBeGreaterThan(measureText('0', 11))
    expect(measureText('0', 22)).toBeGreaterThan(measureText('0', 11))
  })

  test('an empty string measures zero', () => {
    expect(measureText('', 11)).toBe(0)
  })

  test('repeated measurement is stable — the memo cannot return a different width', () => {
    resetTextMetrics()
    const first = measureText('2026-08-18', 11)
    expect(measureText('2026-08-18', 11)).toBe(first)
  })

  test('the same text at a different size is NOT a cache hit', () => {
    resetTextMetrics()
    expect(measureText('88', 11)).not.toBe(measureText('88', 30))
  })
})

describe('maxTextWidth', () => {
  test('returns 0 for no labels — an axis with no ticks reserves nothing extra', () => {
    expect(maxTextWidth([], 11)).toBe(0)
  })

  test('returns the widest label, not the last', () => {
    const labels = ['1', '1,250,000', '25']
    expect(maxTextWidth(labels, 11)).toBe(measureText('1,250,000', 11))
  })
})
