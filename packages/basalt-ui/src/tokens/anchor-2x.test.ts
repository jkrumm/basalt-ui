/**
 * The v3 palette is the 2.x palette under v3 names (owner review 2026-11-11, Issue 820): every
 * surface, ink and accent role equals its 2.x counterpart, and every text pair reads at least as well
 * as the same pair did in 2.x, never under 4.5:1. The measured ratios are pinned, floored to two
 * decimals, so a retune that moves one shows up here as a number, not as a look.
 */
import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_DERIVE_CONFIG,
  DEFAULT_DERIVE_V3_CONFIG,
  deriveTokens,
  deriveV3,
  INK_FROM_2X,
  INK_MIX_PCT,
  mixHex,
  SURFACE_FROM_2X,
  TINT_PCT,
} from './derive'
import { contrastRatio } from './hct'

type Side = 'light' | 'dark'
type TextSurface = keyof typeof SURFACE_FROM_2X
const SIDES: readonly Side[] = ['light', 'dark']
const TEXT: readonly Exclude<TextSurface, 'raised'>[] = ['canvas', 'card', 'inset']
const TONES = ['good', 'warn', 'bad'] as const

const v3 = deriveV3().colors
const x2 = deriveTokens(DEFAULT_DERIVE_CONFIG)
const floor2 = (n: number): number => Math.floor(n * 100) / 100
const tintOf = (surface: string, tone: string, side: Side): string =>
  mixHex(surface, tone, TINT_PCT[side] / 100)

describe('every v3 role is its 2.x counterpart', () => {
  test('the default config is the 2.x default: #0077bd, zinc, vibrancy 0', () => {
    expect(DEFAULT_DERIVE_V3_CONFIG).toEqual({
      accent: DEFAULT_DERIVE_CONFIG.accent,
      neutral: DEFAULT_DERIVE_CONFIG.neutral,
      vibrancy: DEFAULT_DERIVE_CONFIG.vibrancy,
    })
  })

  test('surfaces and inks are the 2.x stops, in both schemes', () => {
    for (const [role, from] of Object.entries(SURFACE_FROM_2X))
      expect(v3[role as TextSurface]).toEqual(x2.surface[from])
    for (const [role, from] of Object.entries(INK_FROM_2X))
      expect(v3[role as keyof typeof INK_FROM_2X]).toEqual(x2.ink[from])
  })

  test('the brand fill and its label are the 2.x accent fill and on-accent', () => {
    expect(v3['brand-fill']).toEqual(x2.accentFill)
    expect(v3['on-brand']).toEqual(x2.onAccent)
    expect(v3['chart-1']).toEqual(x2.accentFill)
  })

  test('the hairline is the 2.x divider over the page (9% ink light; 8% white dark, within one step)', () => {
    const channels = (hex: string): number[] =>
      [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
    const light = mixHex(v3.canvas.light, v3.ink.light, INK_MIX_PCT.hairline.light / 100)
    expect(light).toBe(mixHex(x2.surface.bg.light, x2.ink.ink.light, 0.09))
    const dark = mixHex(v3.canvas.dark, v3.ink.dark, INK_MIX_PCT.hairline.dark / 100)
    const divider2x = mixHex(x2.surface.bg.dark, '#ffffff', 0.08)
    const delta = channels(dark).map((c, i) => Math.abs(c - channels(divider2x)[i]!))
    expect(Math.max(...delta)).toBeLessThanOrEqual(1)
  })
})

describe('text contrast is at least the 2.x pair and never under 4.5:1', () => {
  test('ink and ink-muted on canvas, card and inset', () => {
    for (const side of SIDES)
      for (const [role, from] of Object.entries(INK_FROM_2X))
        for (const bg of TEXT) {
          const now = contrastRatio(v3[role as keyof typeof INK_FROM_2X][side], v3[bg][side])
          const then = contrastRatio(x2.ink[from][side], x2.surface[SURFACE_FROM_2X[bg]][side])
          expect(now).toBeGreaterThanOrEqual(then)
          expect(now).toBeGreaterThanOrEqual(4.5)
        }
  })

  test('status inks on canvas, card and inset, and the brand ink against the 2.x accent ink', () => {
    for (const side of SIDES)
      for (const bg of TEXT) {
        const surface2x = x2.surface[SURFACE_FROM_2X[bg]][side]
        for (const tone of TONES) {
          const now = contrastRatio(v3[tone][side], v3[bg][side])
          expect(now).toBeGreaterThanOrEqual(contrastRatio(x2.status[tone][side], surface2x))
          expect(now).toBeGreaterThanOrEqual(4.5)
        }
        const brand = contrastRatio(v3.brand[side], v3[bg][side])
        expect(brand).toBeGreaterThanOrEqual(contrastRatio(x2.accent[side], surface2x))
        expect(brand).toBeGreaterThanOrEqual(4.5)
      }
  })

  test('every tone reads on its own tint over every surface (the delta and status badges)', () => {
    for (const side of SIDES)
      for (const tone of [...TONES, 'info'] as const)
        for (const bg of [...TEXT, 'raised'] as const)
          expect(
            contrastRatio(v3[tone][side], tintOf(v3[bg][side], v3[tone][side], side)),
          ).toBeGreaterThanOrEqual(4.5)
  })

  // Measured on the default config, floored to two decimals: [canvas, card, inset].
  const MEASURED: Record<Side, Record<string, readonly number[]>> = {
    light: {
      ink: [13.5, 13.75, 15.08],
      'ink-muted': [6.96, 7.09, 7.78],
      brand: [4.56, 4.65, 5.1],
      good: [5.3, 5.4, 5.92],
      'good-tint': [4.52, 4.58, 5],
      warn: [5.3, 5.4, 5.92],
      'warn-tint': [4.51, 4.57, 4.99],
      bad: [5.35, 5.45, 5.98],
      'bad-tint': [4.5, 4.59, 4.97],
      info: [5.81, 5.92, 6.49],
      'info-tint': [4.92, 4.99, 5.45],
    },
    dark: {
      ink: [11.85, 10.17, 11.85],
      'ink-muted': [10.07, 8.64, 10.07],
      brand: [8.22, 7.05, 8.22],
      good: [7.98, 6.84, 7.98],
      'good-tint': [5.64, 4.9, 5.64],
      warn: [7.93, 6.81, 7.93],
      'warn-tint': [5.64, 4.9, 5.64],
      bad: [7.88, 6.76, 7.88],
      'bad-tint': [5.6, 4.87, 5.6],
      info: [8.22, 7.05, 8.22],
      'info-tint': [5.74, 4.99, 5.74],
    },
  }

  test('the measured ratios', () => {
    for (const side of SIDES)
      for (const [key, expected] of Object.entries(MEASURED[side])) {
        const tinted = key.endsWith('-tint')
        const fg = v3[(tinted ? key.slice(0, -'-tint'.length) : key) as keyof typeof v3][side]
        const measured = TEXT.map((bg) =>
          floor2(contrastRatio(fg, tinted ? tintOf(v3[bg][side], fg, side) : v3[bg][side])),
        )
        expect({ side, key, measured }).toEqual({ side, key, measured: [...expected] })
      }
  })
})
