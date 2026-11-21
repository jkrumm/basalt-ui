/**
 * Expression cycle 16 (`v3-expr-16-kit-fixes` 6, n75 and n76): an ink-step bar series dims by opacity,
 * since `dimmedPaint`'s floor is the muted ink those bars are drawn in. The rendered geometry is
 * `tests/layout/kit-expr16f-dim.layout.test.ts`.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contrastRatio } from '../tokens/hct'
import { INK_STEP_DIM, barOnCard, isInkStep } from './marks'
import { DEFAULT_BAR_OPACITY } from './parts/bars-marks'

const tokens = readFileSync(join(import.meta.dirname, '../css/tokens.css'), 'utf8')
const card = (scheme: 0 | 1): string =>
  [...tokens.matchAll(/--basalt-card: (#[0-9a-f]{6});/g)][scheme]?.[1] as string

const channels = (hex: string): number[] =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
const over = (hex: string, alpha: number, surface: string): string =>
  `#${channels(hex)
    .map((v, i) =>
      Math.round(v * alpha + (channels(surface)[i] as number) * (1 - alpha))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`

describe('isInkStep', () => {
  test('a grey pair and the ink tokens are steps of the ink scale', () => {
    expect(isInkStep('light-dark(#6b6b6b, #a8a8a8)')).toBe(true)
    expect(isInkStep('#262626')).toBe(true)
    expect(isInkStep('var(--basalt-ink-muted)')).toBe(true)
  })

  test('a hue, a token of the palette and a half-grey pair are not', () => {
    expect(isInkStep('light-dark(#2871c7, #5190f7)')).toBe(false)
    expect(isInkStep('var(--basalt-chart-1)')).toBe(false)
    expect(isInkStep('var(--basalt-brand)')).toBe(false)
    expect(isInkStep('light-dark(#6b6b6b, #5190f7)')).toBe(false)
  })
})

describe('a dimmed ink-step bar', () => {
  test('is the resting bar at INK_STEP_DIM of its opacity, flattened over the card', () => {
    const color = 'light-dark(#6b6b6b, #a8a8a8)'
    expect(barOnCard(color, DEFAULT_BAR_OPACITY, 'dimmed')).toBe(
      `color-mix(in srgb, ${color} ${Math.round(DEFAULT_BAR_OPACITY * INK_STEP_DIM * 1000) / 10}%, var(--basalt-card))`,
    )
  })

  test('recedes from its resting paint by 1.3:1 and keeps 2.5:1 on the card in both schemes', () => {
    for (const [scheme, grey] of [
      [0, '#6b6b6b'],
      [1, '#a8a8a8'],
    ] as const) {
      const surface = card(scheme)
      const rest = over(grey, DEFAULT_BAR_OPACITY, surface)
      const dimmed = over(grey, DEFAULT_BAR_OPACITY * INK_STEP_DIM, surface)
      expect(contrastRatio(rest, dimmed)).toBeGreaterThan(1.3)
      expect(contrastRatio(dimmed, surface)).toBeGreaterThanOrEqual(2.5)
    }
  })
})
