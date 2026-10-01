import { describe, expect, test } from 'bun:test'
import { hasIcon, initial } from './nav-glyph'

describe('initial', () => {
  test('uppercases the first letter', () => {
    expect(initial('inbox')).toBe('I')
  })

  test('an empty label falls back to a question mark', () => {
    expect(initial('')).toBe('?')
  })

  test('keeps a whole grapheme, not a lone code unit', () => {
    expect(initial('👨‍👩‍👧 Family')).toBe('👨‍👩‍👧') // ZWJ sequence
    expect(initial('🇩🇪 Germany')).toBe('🇩🇪') // regional-indicator pair
    expect(initial('école')).toBe('É') // base + combining acute
  })
})

describe('hasIcon', () => {
  test.each([null, undefined, false, true, ''])('%p is absent — React renders nothing', (icon) => {
    expect(hasIcon(icon)).toBe(false)
  })

  test.each([0, 'x', <svg key="s" />])('%p is a present icon', (icon) => {
    expect(hasIcon(icon)).toBe(true)
  })
})
