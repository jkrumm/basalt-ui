/**
 * `buildRadiusCss` — the pure CSS-building half of the `{ radius }` option: the overriding
 * `--vx-radius-*` declarations for a resolved value; mirrors `build-fonts-css.test.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { deriveRadius } from './palette'
import { buildRadiusCss } from './core'

describe('buildRadiusCss', () => {
  test('returns empty string when radius is undefined', () => {
    expect(buildRadiusCss(undefined)).toBe('')
  })

  test('emits all five overriding declarations under one :root block', () => {
    const css = buildRadiusCss(deriveRadius(2))
    expect(css).toContain(':root {')
    expect(css).toContain('--vx-radius-card: 12px;')
    expect(css).toContain('--vx-radius-ctrl: 8px;')
    expect(css).toContain('--vx-radius-tight: 7px;')
    expect(css).toContain('--vx-radius-fine: 6px;')
    expect(css).toContain('--vx-radius-floating: 13px;')
  })
})
