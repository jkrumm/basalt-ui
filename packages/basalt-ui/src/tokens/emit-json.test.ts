/**
 * The JSON emitter (static-framework-free section 3 row 4, amendment A1): the opaque roles as
 * resolved hex, read from the same table as the CSS emit, so a manifest and a stylesheet cannot
 * disagree.
 */
import { describe, expect, test } from 'bun:test'
import { DEFAULT_DERIVE_V3_CONFIG } from './derive'
import { emitTokensCss } from './emit'
import { emitJson, emitJsonText } from './emit-json'
import { GateError } from './gates'

const OPTIONS = { version: '3.0.0' } as const
const ALPHA = ['hairline', 'hover', 'selected', 'scrim', 'input', 'grid', 'crosshair']

/** The `--vx-*` declarations of the rule that opens with `selector`, as name -> value. */
function declsOf(css: string, selector: string): Map<string, string> {
  const start = css.indexOf(`${selector} {\n`)
  expect(start).toBeGreaterThanOrEqual(0)
  const body = css.slice(start, css.indexOf('}', start))
  return new Map(
    [...body.matchAll(/^\s*(--vx-[\w-]+): (.+);$/gm)].map((m) => [m[1]!, m[2]!] as const),
  )
}

describe('emitJson', () => {
  const json = emitJson(OPTIONS)
  const css = emitTokensCss(OPTIONS)
  const sides = {
    light: declsOf(css, ":root,\n:root[data-theme='light']"),
    dark: declsOf(css, ":root[data-theme='dark']"),
  }

  test('carries the header fields, the contract and the two schemes, in that order', () => {
    expect(Object.keys(json)).toEqual(['$generated', '$provenance', 'contract', 'schemes'])
    expect(json.contract).toBe(3)
    expect(json.$provenance).toBe('basalt-ui 3.0.0 — `basalt-ui tokens:css --format json`')
    expect(Object.keys(json.schemes)).toEqual(['light', 'dark'])
  })

  test('every role and scheme equals the colour the CSS emit declares', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const roles = Object.entries(json.schemes[scheme])
      expect(roles.length).toBeGreaterThan(20)
      for (const [role, hex] of roles) {
        expect(sides[scheme].get(`--vx-${role}`)).toBe(hex)
      }
    }
  })

  test('chart-1..5 and seq-1..5 are in it, in both schemes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      for (const n of [1, 2, 3, 4, 5]) {
        expect(json.schemes[scheme][`chart-${n}`]).toMatch(/^#[0-9a-f]{6}$/)
        expect(json.schemes[scheme][`seq-${n}`]).toMatch(/^#[0-9a-f]{6}$/)
      }
    }
  })

  test('both schemes list the same roles, every value is #rrggbb', () => {
    expect(Object.keys(json.schemes.dark)).toEqual(Object.keys(json.schemes.light))
    for (const scheme of ['light', 'dark'] as const) {
      for (const hex of Object.values(json.schemes[scheme])) expect(hex).toMatch(/^#[0-9a-f]{6}$/)
    }
  })

  test('no alpha mix is in it: not hairline, hover, selected, scrim, nor anything ending in -tint', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const roles = Object.keys(json.schemes[scheme])
      for (const alpha of ALPHA) expect(roles).not.toContain(alpha)
      expect(roles.filter((r) => r.endsWith('-tint'))).toEqual([])
    }
  })

  test('two emits are byte-equal', () => {
    expect(emitJsonText(OPTIONS)).toBe(
      emitJsonText({ ...OPTIONS, config: { ...DEFAULT_DERIVE_V3_CONFIG } }),
    )
    expect(emitJsonText(OPTIONS).endsWith('}\n')).toBe(true)
  })

  test('another accent moves the brand and what is derived from its hue, and nothing else', () => {
    const teal = emitJson({ ...OPTIONS, config: { accent: '#0f8a7e' } })
    const stable = [
      'canvas',
      'inset',
      'card',
      'raised',
      'ink',
      'ink-muted',
      'ink-faint',
      'good',
      'warn',
      'bad',
      'line',
      'dim-bar',
      'on-brand',
      'chart-2',
    ]
    for (const scheme of ['light', 'dark'] as const) {
      for (const role of stable) expect(teal.schemes[scheme][role]).toBe(json.schemes[scheme][role])
      expect(teal.schemes[scheme]['brand']).not.toBe(json.schemes[scheme]['brand'])
      expect(teal.schemes[scheme]['brand-fill']).not.toBe(json.schemes[scheme]['brand-fill'])
      // The roles that did move are the seed-hue ones: the brand family, info (brand ink), the
      // categorical series (chart-1 is brand-fill, the others re-lit off it) and the ramp.
      const moved = Object.keys(json.schemes[scheme]).filter(
        (r) => teal.schemes[scheme][r] !== json.schemes[scheme][r],
      )
      for (const role of moved) {
        expect(role).toMatch(/^(brand|brand-fill|info|chart-\d|seq-\d)$/)
      }
    }
  })

  test('a config that fails a gate emits nothing', () => {
    const config = { vibrancy: -4, accent: '#ffff00' }
    expect(() => emitJson({ ...OPTIONS, config })).toThrow(GateError)
    expect(() => emitJson({ ...OPTIONS, config })).toThrow(/chart-3-cvd-chart-5/)
  })
})
