/**
 * Regression test for the iOS input-zoom FLOOR itself (styles.css).
 *
 * This rule is load-bearing for accessibility (Safari zooms the viewport on focus below 16px and
 * never zooms back out) — it must never be silently softened (dropping `!important`, so an inline
 * `style` attribute defeats it again) or dropped (losing `max()`, turning the floor into a pin that
 * fights a deliberately larger input). Both properties are asserted directly against the shipped
 * CSS text, independent of the `check-theme` guard (which scans CONSUMER source, not this file).
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'bun:test'

const STYLES_CSS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'styles.css')

describe('styles.css — iOS input floor', () => {
  const css = readFileSync(STYLES_CSS_PATH, 'utf8')

  it('declares the floor rule on input, select, textarea', () => {
    expect(css).toMatch(/input\s*,\s*\n?\s*select\s*,\s*\n?\s*textarea\s*\{/)
  })

  it('keeps max(16px, …) — a FLOOR, not a pin', () => {
    expect(css).toContain('max(16px')
  })

  it('is !important — un-defeatable by an inline style attribute', () => {
    const ruleMatch = css.match(
      /input\s*,\s*\n?\s*select\s*,\s*\n?\s*textarea\s*\{\s*\n?\s*font-size:\s*([^;]+);/,
    )
    expect(ruleMatch).not.toBeNull()
    expect(ruleMatch?.[1]).toContain('max(16px')
    expect(ruleMatch?.[1]).toContain('!important')
  })
})
