import { describe, expect, test } from 'bun:test'
import { resolveColorMix } from './vite-color-mix'

describe('resolveColorMix', () => {
  test('resolves SURFACE.bg.light exactly', () => {
    expect(resolveColorMix('color-mix(in srgb, #f4f4f5 50%, #e4e4e7)')).toBe('#ececee')
  })

  test('resolves SURFACE.bg.dark exactly', () => {
    expect(resolveColorMix('color-mix(in srgb, #27272a 70%, #18181b)')).toBe('#232326')
  })

  test('passes through a plain 6-digit hex unchanged (lowercased)', () => {
    expect(resolveColorMix('#ABCDEF')).toBe('#abcdef')
  })

  test('expands a plain 3-digit hex', () => {
    expect(resolveColorMix('#fff')).toBe('#ffffff')
  })

  test('resolves trivial named colors', () => {
    expect(resolveColorMix('white')).toBe('#ffffff')
    expect(resolveColorMix('black')).toBe('#000000')
  })

  test('defaults to a 50/50 mix when neither side carries a percentage', () => {
    expect(resolveColorMix('color-mix(in srgb, #000000, #ffffff)')).toBe('#808080')
  })

  test('resolves nested color-mix expressions recursively', () => {
    // inner: 50/50 of black/white -> #808080; outer: 50/50 of that and black -> #404040
    expect(
      resolveColorMix('color-mix(in srgb, color-mix(in srgb, #000000 50%, #ffffff) 50%, #000000)'),
    ).toBe('#404040')
  })

  test('throws a clear error for an unresolvable input', () => {
    expect(() => resolveColorMix('red')).toThrow(/Unresolvable color-mix input: "red"/)
  })

  test('throws a clear error for a non-srgb color space', () => {
    expect(() => resolveColorMix('color-mix(in oklab, #000000 50%, #ffffff)')).toThrow(
      /Unresolvable color-mix input/,
    )
  })
})
