/**
 * `createBasaltTheme`'s `{ derive }` option — the graduation of the six-knob derive config into a
 * first-class consumer API. Two invariants:
 *
 *  1. The DEFAULT path (no `options`, or a `derive` that resolves back to
 *     `DEFAULT_DERIVE_CONFIG`) stays byte-identical to the pre-baked static palette — zero extra
 *     derivation work, and `theme.other.basaltDerive` stays unset (the provider's "or is absent"
 *     tolerance).
 *  2. A NON-default config lands the fully-resolved `DeriveConfig` on `theme.other.basaltDerive`
 *     (so `BasaltProvider` can inject the matching stylesheet) and produces `--vx-*` CSS that
 *     differs from the shipped default.
 */
import { describe, expect, test } from 'bun:test'
import { buildPaletteCss } from '../tokens'
import { DEFAULT_DERIVE_CONFIG, resolveDeriveConfig } from '../tokens/derive'
import { buildPaletteData } from '../tokens/palette'
import { createBasaltTheme } from './index'

describe('the default derive config stays on the static path', () => {
  test('createBasaltTheme() carries no theme.other.basaltDerive', () => {
    expect(createBasaltTheme().other?.['basaltDerive']).toBeUndefined()
  })

  test('createBasaltTheme(undefined, {}) resolves to the same default', () => {
    expect(createBasaltTheme(undefined, {}).other?.['basaltDerive']).toBeUndefined()
  })

  test('a derive option that resolves back to the default also carries no basaltDerive', () => {
    const theme = createBasaltTheme(undefined, { derive: { ...DEFAULT_DERIVE_CONFIG } })
    expect(theme.other?.['basaltDerive']).toBeUndefined()
  })

  test('the default palette CSS is byte-identical to the static path', () => {
    expect(buildPaletteCss(undefined, buildPaletteData(DEFAULT_DERIVE_CONFIG))).toBe(
      buildPaletteCss(),
    )
  })
})

describe('a non-default derive config graduates onto the theme', () => {
  const partial = { accent: '#16a34a' }
  const theme = createBasaltTheme(undefined, { derive: partial })

  test('the resolved config lands on theme.other.basaltDerive', () => {
    expect(theme.other?.['basaltDerive']).toEqual(resolveDeriveConfig(partial))
  })

  test('its palette CSS differs from the shipped default', () => {
    const resolved = resolveDeriveConfig(partial)
    const customCss = buildPaletteCss(undefined, buildPaletteData(resolved))
    expect(customCss).not.toBe(buildPaletteCss())
  })

  test('the accent fill in theme.colors.blue follows the custom seed', () => {
    const resolved = resolveDeriveConfig(partial)
    const data = buildPaletteData(resolved)
    const blue = theme.colors?.['blue']
    expect(blue?.[6]).toBe(data.ACCENT.accentFill.light)
  })
})

describe('consumer overrides still win on top of a derive config', () => {
  test('an explicit override merges onto the derived theme', () => {
    const theme = createBasaltTheme({ primaryColor: 'green' }, { derive: { accent: '#16a34a' } })
    expect(theme.primaryColor).toBe('green')
    expect(theme.other?.['basaltDerive']).toEqual(resolveDeriveConfig({ accent: '#16a34a' }))
  })
})

describe('a non-default derive config yields a dark tuple that tracks its own derived data', () => {
  // `accent` alone doesn't move the dark tuple (it's built from INK/SURFACE, which key off
  // `neutral` + `darkLevel`, not the accent seed) — vary `darkLevel` so the tuple's surface-based
  // stops (border/hover/panel/body) actually diverge from the shipped default's.
  const partial = { darkLevel: 3 }
  const resolved = resolveDeriveConfig(partial)
  const data = buildPaletteData(resolved)
  const theme = createBasaltTheme(undefined, { derive: partial })

  test('theme.colors.dark follows the derived data', () => {
    expect(theme.colors?.['dark']?.[0]).toBe(data.INK.ink.dark)
    expect(theme.colors?.['dark']?.[7]).toBe(data.SURFACE.bg.dark)
  })

  test("a non-default config yields a dark tuple that differs from the DEFAULT theme's", () => {
    expect(theme.colors?.['dark']).not.toEqual(createBasaltTheme().colors?.['dark'])
  })
})

describe('a malformed accent seed throws through createBasaltTheme', () => {
  test('rejects a non-hex color name', () => {
    expect(() => createBasaltTheme(undefined, { derive: { accent: 'red' } })).toThrow()
  })

  test('rejects a truncated hex', () => {
    expect(() => createBasaltTheme(undefined, { derive: { accent: '#12' } })).toThrow()
  })

  test('rejects a non-hex-digit hex', () => {
    expect(() => createBasaltTheme(undefined, { derive: { accent: '#zzzzzz' } })).toThrow()
  })
})
