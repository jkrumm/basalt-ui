/**
 * The emitter pair: `color-scheme` on every scheme block, the always-on OS fallback built from the
 * dark declaration list, the gate refusal, and two byte-exact golden sheets.
 *
 * Regenerate the goldens after an intended emit change:
 *   UPDATE_GOLDEN=1 bun test packages/basalt-ui/src/tokens/emit-fallback.test.ts
 */
import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_DERIVE_V3_CONFIG, deriveV3 } from './derive'
import { emitDerived, emitTokensCss } from './emit'
import { schemeBlocks } from './emit-fallback'
import { hctToHex } from './hct'

const OPTIONS = { version: '3.0.0' } as const
const HUE_268 = hctToHex({ hue: 268, chroma: 48, tone: 50 })

const GOLDENS = {
  'default.css': emitTokensCss(OPTIONS),
  'hue-268-vibrancy-1.css': emitTokensCss({
    ...OPTIONS,
    config: { accent: HUE_268, vibrancy: 1 },
  }),
}

const declsOf = (css: string, head: string): string => {
  const at = css.indexOf(head)
  expect(at).toBeGreaterThanOrEqual(0)
  const rest = css.slice(at + head.length)
  return rest.slice(0, rest.indexOf('}'))
}

const LIGHT = ":root,\n:root[data-theme='light'] {"
const DARK = "@media not print {\n  :root[data-theme='dark'] {"
const AUTO =
  '@media not print {\n  @media (prefers-color-scheme: dark) {\n    :root:not([data-theme]) {'

describe('scheme blocks', () => {
  const css = GOLDENS['default.css']

  test('each scheme block carries exactly one color-scheme', () => {
    for (const [head, scheme] of [
      [LIGHT, 'light'],
      [DARK, 'dark'],
      [AUTO, 'dark'],
    ] as const) {
      const body = declsOf(css, head)
      expect(body.match(/color-scheme:/g)).toHaveLength(1)
      expect(body).toContain(`color-scheme: ${scheme};`)
    }
  })

  test('the fallback declarations are string-equal to the dark block, modulo indentation', () => {
    const lines = (s: string): string[] => s.split('\n').map((l) => l.trim())
    expect(lines(declsOf(css, AUTO))).toEqual(lines(declsOf(css, DARK)))
  })

  test('schemeBlocks renders the fallback from the one dark list', () => {
    const out = schemeBlocks({ light: 'a', dark: 'b', auto: 'c' }, [['x', '1']], [['y', '2']])
    expect(out.match(/y: 2;/g)).toHaveLength(2)
    expect(out).toContain('@media (prefers-color-scheme: dark)')
  })

  test('no dark value appears outside `@media not print`', () => {
    const derived = deriveV3()
    const printable = css.slice(0, css.indexOf('@media not print')).toLowerCase()
    const scalars = css.slice(css.indexOf(':root {')).toLowerCase()
    expect(printable).toContain(derived.colors.canvas.light.toLowerCase())
    for (const name of ['canvas', 'inset', 'card', 'raised'] as const) {
      const dark = derived.colors[name].dark.toLowerCase()
      expect(printable).not.toContain(dark)
      expect(scalars).not.toContain(dark)
    }
    expect(css).not.toMatch(/^(?:\[data-theme='dark'\]|:root\[data-theme='dark'\])/m)
  })

  test('a failing accent refuses with gate, surface and ratio', () => {
    const derived = deriveV3()
    const weak = { light: derived.colors['brand-fill'].light, dark: '#1d4f7e' }
    const poisoned = { ...derived, colors: { ...derived.colors, 'brand-fill': weak } }
    expect(() => emitDerived(poisoned, OPTIONS)).toThrow(
      /fill-on-inset dark \d\.\d\d < 3\.0 for --accent #[0-9a-f]{6}\. Raise --vibrancy or pick another hue\./,
    )
  })

  test('the default config is what the first golden pins', () => {
    expect(emitTokensCss({ ...OPTIONS, config: { ...DEFAULT_DERIVE_V3_CONFIG } })).toBe(css)
  })
})

describe('golden files', () => {
  for (const [name, fresh] of Object.entries(GOLDENS)) {
    const path = join(import.meta.dir, 'golden', name)
    test(`${name} matches a fresh emit byte for byte`, () => {
      if (process.env['UPDATE_GOLDEN'] === '1') writeFileSync(path, fresh)
      expect(existsSync(path)).toBe(true)
      expect(readFileSync(path, 'utf8')).toBe(fresh)
    })
  }
})
