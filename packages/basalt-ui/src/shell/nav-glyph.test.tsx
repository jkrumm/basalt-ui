import { describe, expect, test } from 'bun:test'
import { hasIcon } from './nav-glyph'

describe('hasIcon', () => {
  test.each([null, undefined, false, true, ''])('%p is absent — React renders nothing', (icon) => {
    expect(hasIcon(icon)).toBe(false)
  })

  test.each([0, 'x', <svg key="s" />])('%p is a present icon', (icon) => {
    expect(hasIcon(icon)).toBe(true)
  })
})
