/**
 * The v3 table (tokens-visual 3.2): the emitted public `--vx-*` name set is the 74 booked names
 * plus `--vx-input`, the one name the S3 spike added (docs/v3/spikes/token-surfaces.md), and stays
 * under the 90 ceiling. Values come from the derivation; this file pins the shape, not a hex.
 */
import { describe, expect, test } from 'bun:test'
import { deriveV3 } from './derive'
import { emitTokensCss, tokenNames, zoneADenial } from './emit'
import {
  bridgeEntries,
  COARSE,
  COLOR_ALIASES,
  DENSITY,
  isPair,
  resolveTokens,
  tokenByName,
  TOKENS,
} from './table'

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1)

/** tokens-visual 3.2, family by family: 74 names. */
const BOOKED_74: readonly string[] = [
  'canvas',
  'inset',
  'card',
  'raised',
  'surface',
  'hover',
  'selected',
  'scrim',
  'hairline',
  'ink',
  'ink-muted',
  'ink-faint',
  'brand',
  'brand-fill',
  'on-brand',
  'good',
  'warn',
  'bad',
  'info',
  'tint-pct',
  'line',
  'dim-bar',
  'grid',
  'crosshair',
  ...range(5).map((n) => `chart-${n}`),
  ...range(5).map((n) => `seq-${n}`),
  'shadow-card',
  'shadow-raised',
  'shadow-overlay',
  'radius-card',
  'radius-inset',
  'radius-ctrl',
  'radius-chip',
  'ctl-h',
  'row-h',
  'icon',
  'hit',
  'font-sans',
  'font-head',
  'font-mono',
  'font-head-stretch',
  'weight-body',
  'weight-medium',
  'weight-strong',
  ...['micro', 'xs', 'sm', 'md', 'base', 'lg', 'display'].flatMap((r) => [
    `text-${r}`,
    `text-${r}-lh`,
  ]),
  'dur-fast',
  'dur-base',
  'ease',
  'measure',
  'rhythm-1',
  'rhythm-2',
  'rhythm-3',
  'contract',
].map((name) => `--vx-${name}`)

describe('public names', () => {
  test('the 3.2 list is 74 names', () => {
    expect(BOOKED_74).toHaveLength(74)
    expect(new Set(BOOKED_74).size).toBe(74)
  })

  test('the emitted --vx-* name set equals the 74 names of 3.2 plus --vx-input, and is at most 90', () => {
    const css = emitTokensCss({ version: '3.0.0' })
    const emitted = new Set([...css.matchAll(/(--vx-[a-z0-9-]+)\s*:/g)].map((m) => m[1]!))
    expect([...emitted].sort()).toEqual([...BOOKED_74, '--vx-input'].sort())
    expect(emitted.size).toBe(75)
    expect(emitted.size).toBeLessThanOrEqual(90)
    expect([...tokenNames()].sort()).toEqual([...emitted].sort())
  })

  test('every name is kebab-case and unique', () => {
    const names = TOKENS.map((t) => t.name)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9-]*$/)
  })

  test('the 2.x word "accent" names nothing the blue: --color-accent is the hover surface', () => {
    const accent = bridgeEntries().filter((e) => e.tw === '--color-accent')
    expect(accent.map((e) => e.token)).toEqual(['hover'])
    expect(TOKENS.some((t) => t.name.includes('accent'))).toBe(false)
  })
})

describe('values', () => {
  const tokens = resolveTokens()

  test('colour roles are pairs, scalars are strings, and nothing is empty', () => {
    for (const { def, value } of tokens) {
      if (isPair(value)) {
        expect(value.light.length).toBeGreaterThan(0)
        expect(value.dark.length).toBeGreaterThan(0)
      } else {
        expect(value.length, def.name).toBeGreaterThan(0)
      }
    }
    expect(isPair(tokenByName('canvas').value(deriveV3()))).toBe(true)
    expect(isPair(tokenByName('radius-card').value(deriveV3()))).toBe(false)
  })

  test('radii are 14/10/8/5 and the type ladder is seven rem rungs', () => {
    const scalar = (name: string): string => {
      const value = tokens.find((t) => t.def.name === name)!.value
      if (isPair(value)) throw new Error(`${name} is a pair`)
      return value
    }
    expect(['card', 'inset', 'ctrl', 'chip'].map((r) => scalar(`radius-${r}`))).toEqual([
      '14px',
      '10px',
      '8px',
      '5px',
    ])
    const rungs = ['micro', 'xs', 'sm', 'md', 'base', 'lg', 'display']
    const px = rungs.map((r) => Number.parseFloat(scalar(`text-${r}`)) * 16)
    expect(px).toEqual([11, 12, 13, 15, 16, 18, 30])
    // Ladder law: adjacent UI rungs 1.06-1.17 apart, display excepted.
    for (let i = 1; i < 6; i++) {
      expect(px[i]! / px[i - 1]!).toBeGreaterThanOrEqual(1.06)
      expect(px[i]! / px[i - 1]!).toBeLessThanOrEqual(1.17)
    }
  })

  test('density moves control and row height only; coarse raises the row floor to 44px', () => {
    expect(DENSITY.dense).toEqual({ 'ctl-h': '1.75rem', 'row-h': '2rem' })
    expect(DENSITY.normal).toEqual({ 'ctl-h': '2rem', 'row-h': '2.5rem' })
    expect(DENSITY.comfortable).toEqual({ 'ctl-h': '2.5rem', 'row-h': '3rem' })
    expect(COARSE).toEqual({ 'row-h': '2.75rem', hit: '2.75rem' })
  })
})

describe('bridge targets', () => {
  const entries = bridgeEntries()

  test('every target is unique and references a token the table owns', () => {
    const tw = entries.map((e) => e.tw)
    expect(new Set(tw).size).toBe(tw.length)
    for (const e of entries) expect(() => tokenByName(e.token)).not.toThrow()
  })

  test('secondary is raised without a ring: the S2 spike refuted the light hairline', () => {
    expect(COLOR_ALIASES.find((a) => a.tw === '--color-secondary')?.token).toBe('raised')
  })

  test('zone A denial is generated from the earned targets', () => {
    const { names, prefixes, deniedOutright, allowedCurrent } = zoneADenial()
    const status = ['good', 'warn', 'bad', 'info', 'destructive']
    expect(names.sort()).toEqual(
      [
        'brand',
        'brand-fill',
        'on-brand',
        ...status,
        ...status.map((s) => `${s}-tint`),
        'ring',
        'line',
        ...range(5).map((n) => `chart-${n}`),
        ...range(5).map((n) => `seq-${n}`),
      ].sort(),
    )
    // Neutral roles stay usable; hue roles are the denial.
    for (const neutral of ['background', 'card', 'foreground', 'border', 'accent', 'dim-bar']) {
      expect(names).not.toContain(neutral)
    }
    expect(prefixes).toContain('text')
    expect(deniedOutright).toContain('bg-current')
    expect(allowedCurrent).toEqual(['fill-current', 'stroke-current', 'text-current'])
  })
})
