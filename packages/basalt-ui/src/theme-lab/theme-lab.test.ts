/**
 * The theme-lab wiring gate.
 *
 * The lab is a list of `--vx-*` var names it writes onto `<html>`. Nothing structurally connects
 * that list to the vars the palette actually EMITS, or to the chrome that reads them — so it can
 * drift silently into tuning dead variables, or into tuning live ones that no component consumes.
 * Both failure modes look identical to the user: "the theme lab does nothing".
 *
 * `COLOR_GROUPS` is now a structural-token inspector ONLY (identity/color tuning moved to
 * `DeriveControls`) — this test ties the remaining vars to `buildPaletteCss`'s actual output, so a
 * var in `COLOR_GROUPS` that is secretly DERIVED (and would drift the moment the derive config
 * changes) never sneaks back in undetected.
 */
import { describe, expect, test } from 'bun:test'
import { buildPaletteCss } from '../tokens'
import { AREA_BOTTOM_VAR, AREA_TOP_VAR, COLOR_GROUPS } from './index'

const css = buildPaletteCss()
const TUNABLES = COLOR_GROUPS.flatMap((g) => g.items.map((i) => i.var))

describe('every tunable var is really emitted by the palette', () => {
  // A var in COLOR_GROUPS that buildPaletteCss never declares is a dead knob: the ColorInput shows
  // an empty swatch and writing it changes nothing.
  for (const name of [...TUNABLES, AREA_TOP_VAR, AREA_BOTTOM_VAR]) {
    test(name, () => {
      expect(css).toContain(`${name}:`)
    })
  }
})

describe('tunables are OPAQUE — ColorInput (format="hex") has no alpha channel', () => {
  // A translucent token (`--vx-divider`, `--vx-grid`, `--vx-good`: `color-mix(… , transparent)`)
  // would be silently flattened to a solid color on first edit. Opaque `color-mix()`es are fine —
  // `readVar` resolves them through a probe element, so they display and edit correctly.
  for (const name of TUNABLES) {
    test(name, () => {
      const declaration = css.match(new RegExp(`${name}:\\s*([^;]+);`))?.[1]?.trim() ?? ''
      expect(declaration).not.toContain('transparent')
      expect(declaration).not.toMatch(/^rgba\(/)
    })
  }
})

test('no duplicate tunables across groups', () => {
  expect(new Set(TUNABLES).size).toBe(TUNABLES.length)
})
