/**
 * `buildRadiusCss` — the pure CSS-building half of the `{ radius }` option (see
 * `../theme/radius-option.test.ts` for the `theme.other.basaltRadius` round-trip this consumes).
 * `BasaltBridge` calls this directly to append overriding `--vx-radius-*` declarations to the same
 * injected `<style>` as the palette CSS; mirrors `build-fonts-css.test.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { deriveRadius } from './palette'
import { buildRadiusCss } from './index'

describe('buildRadiusCss', () => {
  test('returns empty string when radius is undefined', () => {
    expect(buildRadiusCss(undefined)).toBe('')
  })

  test('emits all five overriding declarations under one :root block', () => {
    const css = buildRadiusCss(deriveRadius(2))
    expect(css).toContain(':root {')
    expect(css).toContain('--vx-radius-card: 9px;')
    expect(css).toContain('--vx-radius-ctrl: 8px;')
    expect(css).toContain('--vx-radius-tight: 7px;')
    expect(css).toContain('--vx-radius-fine: 6px;')
    expect(css).toContain('--vx-radius-floating: 10px;')
  })
})
