/**
 * The emitter (tokens-visual 3.1, 4): deterministic, two-line provenance header, a snapshot as the
 * guarantee of the whole sheet, and a refusal when a gate fails.
 */
import { describe, expect, test } from 'bun:test'
import { GENERATED_HEADER_LINE as GUARD_HEADER_LINE } from '../guard'
import { DEFAULT_DERIVE_V3_CONFIG, deriveV3 } from './derive'
import {
  emitDerived,
  emitTokensCss,
  emitVxTypes,
  GENERATED_HEADER_LINE,
  provenanceHeader,
  tokenNames,
  zoneADenial,
} from './emit'
import { GateError } from './gates'

const OPTIONS = { version: '3.0.0' } as const

describe('emitTokensCss', () => {
  const css = emitTokensCss(OPTIONS)

  test('emitting twice is byte-identical', () => {
    expect(emitTokensCss(OPTIONS)).toBe(css)
    expect(emitTokensCss({ ...OPTIONS, config: { ...DEFAULT_DERIVE_V3_CONFIG } })).toBe(css)
  })

  test('starts with the two-line provenance header the raw-hex scan keys on', () => {
    const [line1, line2] = css.split('\n')
    expect(line1).toBe(GUARD_HEADER_LINE)
    expect(GENERATED_HEADER_LINE).toBe(GUARD_HEADER_LINE)
    expect(line2).toBe('/* basalt-ui 3.0.0 — `basalt-ui tokens:css` */')
    expect(line2).toMatch(/^\/\* basalt-ui \d+\.\d+\.\d+\S* — `basalt-ui tokens:css[^`]*` \*\/$/)
    expect(provenanceHeader('1.2.3', 'basalt-ui tokens:css --accent #0f8a7e')).toBe(
      `${GENERATED_HEADER_LINE}\n/* basalt-ui 1.2.3 — \`basalt-ui tokens:css --accent #0f8a7e\` */\n`,
    )
  })

  test('snapshot: the whole default sheet', () => {
    expect(css).toMatchSnapshot()
  })

  test('dark sits in `not print`; auto is the attribute absent plus the OS media block', () => {
    expect(css).toContain("@media not print {\n  :root[data-theme='dark'] {")
    expect(css).toContain(
      '@media not print {\n  @media (prefers-color-scheme: dark) {\n    :root:not([data-theme]) {',
    )
    expect(css).toMatch(/^:root,\n:root\[data-theme='light'\] \{\n {2}color-scheme: light;/m)
  })

  test('the dark block repeated for `auto` is the same declarations as the attribute block', () => {
    const decls = (selector: string): string[] => {
      const rest = css.slice(css.indexOf(selector) + selector.length)
      return rest
        .slice(0, rest.indexOf('}'))
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    }
    const attribute = decls(":root[data-theme='dark'] {")
    expect(attribute.length).toBeGreaterThan(30)
    expect(decls(':root:not([data-theme]) {')).toEqual(attribute)
  })

  test('coarse pointers raise the row floor but never touch `comfortable` (48 stays 48)', () => {
    const coarse = css.slice(css.indexOf('@media (pointer: coarse)'))
    expect(coarse).toContain("[data-density='normal']")
    expect(coarse).toContain(':root:not([data-density])')
    expect(coarse).not.toContain('comfortable')
    expect(coarse).not.toMatch(/(^|\n) {2}:root,/)
    expect(css).not.toContain('any-pointer')
  })

  test('declares only --vx-* custom properties and color-scheme', () => {
    const declared = [...css.matchAll(/^ +([a-z-]+): /gm)].map((m) => m[1]!)
    for (const name of declared)
      expect(name.startsWith('--vx-') || name === 'color-scheme').toBe(true)
  })

  test('refuses a palette that fails a gate, naming the gate', () => {
    const derived = deriveV3()
    const weak = { light: derived.colors['brand-fill'].light, dark: '#1d4f7e' }
    const poisoned = { ...derived, colors: { ...derived.colors, 'brand-fill': weak } }
    expect(() => emitDerived(poisoned, OPTIONS)).toThrow(GateError)
    expect(() => emitDerived(poisoned, OPTIONS)).toThrow(
      /fill-on-inset dark \d\.\d\d < 3\.0 for --accent #2e75b1/,
    )
  })
})

describe('tenant sheets', () => {
  const tenant = emitTokensCss({
    ...OPTIONS,
    selector: ":root[data-tenant='t2']",
    config: { accent: '#0f8a7e', vibrancy: 1 },
  })

  test('carry only the roles that differ from the default, and no scalars', () => {
    expect(tenant).toContain('--vx-brand-fill:')
    expect(tenant).toContain('--vx-chart-1:')
    expect(tenant).not.toContain('--vx-canvas:')
    expect(tenant).not.toContain('--vx-radius-card:')
    expect(tenant.length).toBeLessThan(emitTokensCss(OPTIONS).length / 2)
  })

  test('the default config as a tenant is a header and nothing else', () => {
    expect(
      emitTokensCss({ ...OPTIONS, selector: ":root[data-tenant='t1']" })
        .trimEnd()
        .split('\n'),
    ).toHaveLength(2)
  })

  test('is deterministic', () => {
    expect(
      emitTokensCss({
        ...OPTIONS,
        selector: ":root[data-tenant='t2']",
        config: { accent: '#0f8a7e', vibrancy: 1 },
      }),
    ).toBe(tenant)
  })
})

describe('VX types, names, zone A', () => {
  test('tokenNames lists every public name once', () => {
    const names = tokenNames()
    expect(new Set(names).size).toBe(names.length)
    expect(names.every((n) => n.startsWith('--vx-'))).toBe(true)
  })

  test('snapshot: VX types', () => {
    expect(emitVxTypes(OPTIONS)).toMatchSnapshot()
  })

  test('VX keys are camelCase refs to the same names, one per token', () => {
    const source = emitVxTypes(OPTIONS)
    expect(source.startsWith(GUARD_HEADER_LINE)).toBe(true)
    expect(source).toContain("inkMuted: 'var(--vx-ink-muted)',")
    expect(source).toContain("chart1: 'var(--vx-chart-1)',")
    expect(source).toContain("textSmLh: 'var(--vx-text-sm-lh)',")
    expect([...source.matchAll(/^ {2}\w+: 'var\(/gm)]).toHaveLength(tokenNames().length)
  })

  test('snapshot: zone A denial', () => {
    expect(zoneADenial()).toMatchSnapshot()
  })
})
