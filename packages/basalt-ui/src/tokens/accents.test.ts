import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { ACCENTS, ACCENT_FILLS, ACCENT_NAMES, isAccentName } from './accents'
import { DEFAULT_DERIVE_V3_CONFIG, deriveV3 } from './derive'
import { emitAccentsCss, emitTokensCss, provenanceHeader } from './emit'
import { checkGates } from './gates'
import { hexToHct } from './hct'

const VERSION = '3.0.0'
const header = provenanceHeader(VERSION, 'basalt-ui tokens:css')

describe('the accent set', () => {
  test('six names, the default seed first', () => {
    expect(ACCENT_NAMES).toEqual(['blue', 'violet', 'rose', 'orange', 'green', 'teal'])
    expect(DEFAULT_DERIVE_V3_CONFIG.accent).toBe(ACCENTS.blue)
  })

  test('the seeds spread in hue: no two closer than 25 degrees', () => {
    const hues = ACCENT_NAMES.map((n) => hexToHct(ACCENTS[n]).hue)
    for (const [i, a] of hues.entries())
      for (const b of hues.slice(i + 1)) {
        const gap = Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
        expect(gap).toBeGreaterThanOrEqual(25)
      }
  })

  for (const name of ACCENT_NAMES) {
    test(`${name} passes every contrast gate over the default base`, () => {
      expect(checkGates(deriveV3({ ...DEFAULT_DERIVE_V3_CONFIG, accent: ACCENTS[name] }))).toEqual(
        [],
      )
    })

    test(`${name}'s swatch fill is its derived brand fill in both schemes`, () => {
      const fill = deriveV3({ ...DEFAULT_DERIVE_V3_CONFIG, accent: ACCENTS[name] }).colors[
        'brand-fill'
      ]
      expect(fill).toEqual({ light: ACCENT_FILLS[name], dark: ACCENT_FILLS[name] })
    })
  }

  test('isAccentName takes the six and nothing else', () => {
    expect(ACCENT_NAMES.every(isAccentName)).toBe(true)
    for (const bad of ['', 'Blue', 'red', 'toString', null, 3])
      expect(isAccentName(bad)).toBe(false)
  })
})

describe('emitAccentsCss', () => {
  test('no accent, or only the base, emits the header alone', () => {
    expect(emitAccentsCss({ version: VERSION, accents: [] })).toBe(header)
    expect(emitAccentsCss({ version: VERSION, accents: ['blue'] })).toBe(header)
  })

  test('one block per named accent, scoped to :root[data-accent], every scheme selector', () => {
    const css = emitAccentsCss({ version: VERSION, accents: ['violet', 'teal'] })
    for (const name of ['violet', 'teal']) {
      expect(css).toContain(`:root[data-accent='${name}']:not([data-theme]),`)
      expect(css).toContain(`:root[data-accent='${name}'][data-theme='dark'] {`)
      expect(css).toContain(`:root[data-accent='${name}']:not([data-theme]) {`)
    }
    expect(css).not.toContain("data-accent='rose'")
    expect(css).toContain('--basalt-brand-fill: #8856d2;')
  })

  test('an accent block is the tenant sheet of its seed', () => {
    const tenant = emitTokensCss({
      version: VERSION,
      config: { accent: ACCENTS.rose },
      selector: ":root[data-accent='rose']",
    })
    expect(emitAccentsCss({ version: VERSION, accents: ['rose'] })).toBe(tenant)
  })

  test('the blocks diff against the app base: over a teal base, teal costs nothing and blue a block', () => {
    const css = emitAccentsCss({
      version: VERSION,
      config: { accent: ACCENTS.teal },
      accents: ['teal', 'blue'],
    })
    expect(css).not.toContain("data-accent='teal'")
    expect(css).toContain("data-accent='blue'")
    expect(css).toContain('--basalt-brand-fill: #4374a6;')
  })

  test("the playground's committed accent sheet is what the emitter returns (`make regen` rewrites it)", () => {
    const sheet = readFileSync(
      new URL('../../../../apps/playground/src/accents.css', import.meta.url),
      'utf8',
    )
    const body = (css: string): string => css.split('\n').slice(2).join('\n')
    const want = emitAccentsCss({
      version: VERSION,
      accents: ['violet', 'rose', 'orange', 'green', 'teal'],
    })
    expect(body(sheet)).toBe(body(want))
  })

  test('the default sheet carries no accent selector: an app that ships none pays nothing', () => {
    expect(emitTokensCss({ version: VERSION })).not.toContain('data-accent')
  })
})
