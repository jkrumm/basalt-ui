/**
 * `buildFontsCss` — the pure CSS-building half of the `{ fonts }` option (see
 * `../theme/fonts-option.test.ts` for the `theme.other.basaltFonts` round-trip this consumes).
 * `BasaltBridge` calls this directly to append `--basalt-font-*` declarations to the same injected
 * `<style>` as the palette CSS; no DOM/render harness is configured in this package, so the pure
 * function is the testable seam.
 */
import { describe, expect, test } from 'bun:test'
import { buildFontsCss } from './index'

describe('buildFontsCss', () => {
  test('returns empty string when fonts is undefined', () => {
    expect(buildFontsCss(undefined)).toBe('')
  })

  test('returns empty string when fonts is an empty object', () => {
    expect(buildFontsCss({})).toBe('')
  })

  test('emits a --basalt-font-sans declaration for a provided sans value', () => {
    const css = buildFontsCss({ sans: 'Inter, sans-serif' })
    expect(css).toContain('--basalt-font-sans: Inter, sans-serif;')
  })

  test('emits declarations only for the provided keys, omitting the rest', () => {
    const css = buildFontsCss({ sans: 'Inter, sans-serif' })
    expect(css).not.toContain('--basalt-font-head')
    expect(css).not.toContain('--basalt-font-mono')
  })

  test('emits all three declarations under one :root block when all three are provided', () => {
    const css = buildFontsCss({
      sans: 'Inter, sans-serif',
      head: 'Poppins, sans-serif',
      mono: 'Fira Code, monospace',
    })
    expect(css).toContain(':root {')
    expect(css).toContain('--basalt-font-sans: Inter, sans-serif;')
    expect(css).toContain('--basalt-font-head: Poppins, sans-serif;')
    expect(css).toContain('--basalt-font-mono: Fira Code, monospace;')
  })
})
