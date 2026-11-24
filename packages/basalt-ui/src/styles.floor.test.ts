/**
 * Regression test for the iOS input-zoom FLOOR itself (css/touch.css, imported by styles.css and tailwind.css).
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

const SRC = dirname(fileURLToPath(import.meta.url))
const TOUCH_CSS_PATH = resolve(SRC, 'css/touch.css')

describe('touch.css — iOS input floor', () => {
  const css = readFileSync(TOUCH_CSS_PATH, 'utf8')

  it('holds on a coarse pointer only', () => {
    expect(css).toMatch(/@media \(pointer: coarse\) \{\s*input,/)
  })

  it('is imported by styles.css and by both generated sheets, in the basalt layer', () => {
    expect(readFileSync(resolve(SRC, 'styles.css'), 'utf8')).toContain(
      "@import './css/touch.css' layer(basalt);",
    )
    for (const sheet of ['tailwind.css', 'static.css']) {
      expect(readFileSync(resolve(SRC, 'css', sheet), 'utf8')).toContain(
        "@import './touch.css' layer(basalt);",
      )
    }
  })

  it('has no maximum-scale or user-scalable anywhere in the sheets', () => {
    expect(css.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/maximum-scale|user-scalable/)
  })

  it('declares the floor rule on input, select, textarea', () => {
    expect(css).toMatch(/input\s*,\s*\n?\s*select\s*,\s*\n?\s*textarea\s*\{/)
  })

  it('keeps max(<16px floor var>, …) — a FLOOR, not a pin', () => {
    expect(css).toContain('max(var(--basalt-input-fz-floor, 16px)')
  })

  it('is !important — un-defeatable by an inline style attribute', () => {
    const ruleMatch = css.match(
      /input\s*,\s*\n?\s*select\s*,\s*\n?\s*textarea\s*\{\s*\n?\s*font-size:\s*([^;]+);/,
    )
    expect(ruleMatch).not.toBeNull()
    expect(ruleMatch?.[1]).toContain('max(var(--basalt-input-fz-floor, 16px)')
    expect(ruleMatch?.[1]).toContain('!important')
  })
})
