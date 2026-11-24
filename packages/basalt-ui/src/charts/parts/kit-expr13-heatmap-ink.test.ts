/**
 * Expression cycle 13 kit fixes, the Heatmap label ink (`v3-expr-13-kit-fixes` 8): every annotation on a
 * cell reads against the cell as it is drawn, at rest (4.5:1) and dimmed (3:1, the label at DIMMED_TEXT),
 * in both schemes. The ink is the one `inkOn` picks from the composite (`heatmap-ink.ts`), evaluated here on
 * the shipped tokens: the composite is the sRGB mix of the card and the cell color, as `color-mix` draws it.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { contrastRatio } from '../../tokens/hct'
import { hexToOklab } from '../../tokens/oklab'
import { DIMMED, DIMMED_TEXT } from '../core/theme'
import { ABSENT_OPACITY, RAMP_OPACITIES } from './heatmap-fill'
import { flatInk, stateInk } from './heatmap-ink'

const tokens = readFileSync(join(import.meta.dirname, '../../css/tokens.css'), 'utf8')
/** A shipped token's hex in a scheme: index 0 light, 1 dark, as `tokens.css` declares them. */
const token = (name: string, scheme: 0 | 1): string =>
  [...tokens.matchAll(new RegExp(`--basalt-${name}: (#[0-9a-f]{6});`, 'g'))][scheme]?.[1] as string

const SCHEMES = [
  ['light', 0],
  ['dark', 1],
] as const

const channel = (hex: string, i: number): number =>
  Number.parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16)

/** `base` toward `over` by `share` in sRGB: the composite `color-mix(in srgb, over share%, base)` draws. */
function mixHex(base: string, over: string, share: number): string {
  const out = [0, 1, 2].map((i) =>
    Math.round(channel(base, i) * (1 - share) + channel(over, i) * share),
  )
  return `#${out.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}

/** `inkOn`'s switch: white on a fill darker than OKLab L 0.565, black on a lighter one. */
const inkHex = (fill: string): string => (hexToOklab(fill).L < 0.565 ? '#ffffff' : '#000000')

/** The label as it shows: the ink at `share` over its own cell fill. */
const shown = (ink: string, share: number, fill: string): string => mixHex(fill, ink, share)

/** The fill a value cell draws at `opacity` of its color, over the card. */
const composite = (color: string, opacity: number, scheme: 0 | 1): string =>
  mixHex(token('card', scheme), token(color, scheme), opacity)

describe('the label ink of a value cell reads on its ramp step, at rest and dimmed', () => {
  for (const [name, scheme] of SCHEMES) {
    for (const opacity of RAMP_OPACITIES) {
      const pct = Math.round(opacity * 100)
      test(`${name} brand at ${pct}%: rest reads at 4.5:1`, () => {
        const fill = composite('brand', opacity, scheme)
        expect(contrastRatio(inkHex(fill), fill)).toBeGreaterThanOrEqual(4.5)
      })
      test(`${name} brand at ${pct}%: dimmed reads at 3:1 with the label at DIMMED_TEXT`, () => {
        const fill = composite('brand', opacity * DIMMED, scheme)
        const label = shown(inkHex(fill), DIMMED_TEXT, fill)
        expect(contrastRatio(label, fill)).toBeGreaterThanOrEqual(3)
      })
    }
  }
})

describe('the label ink of an absent cell and of a status state reads', () => {
  for (const [name, scheme] of SCHEMES) {
    test(`${name} absent cell: rest 4.5:1, dimmed 3:1`, () => {
      const rest = composite('line', ABSENT_OPACITY, scheme)
      expect(contrastRatio(inkHex(rest), rest)).toBeGreaterThanOrEqual(4.5)
      const dimmed = composite('line', ABSENT_OPACITY * DIMMED, scheme)
      expect(
        contrastRatio(shown(inkHex(dimmed), DIMMED_TEXT, dimmed), dimmed),
      ).toBeGreaterThanOrEqual(3)
    })
    for (const tone of ['good', 'warn', 'bad'] as const) {
      test(`${name} ${tone} state at rest reads at 4.5:1`, () => {
        const fill = token(tone, scheme)
        expect(contrastRatio(inkHex(fill), fill)).toBeGreaterThanOrEqual(4.5)
      })
    }
  }
})

describe("the ink is written as the kit's relative color, dimmed at DIMMED_TEXT", () => {
  test('a flat dimmed label is the inkOn color at 70% over transparent', () => {
    expect(flatInk('var(--basalt-brand)', 1, true)).toContain(`color-mix(in srgb, oklch(from `)
    expect(flatInk('var(--basalt-brand)', 1, true)).toContain(' 70%, transparent)')
    expect(flatInk('var(--basalt-brand)', 1, false)).not.toContain('70%')
  })

  test('a state whose fill is an alpha() share folds the share into its strength', () => {
    const translucent = 'color-mix(in srgb, var(--basalt-ink-muted) 70%, transparent)'
    expect(stateInk(translucent, 1, false)).toBe(stateInk('var(--basalt-ink-muted)', 0.7, false))
  })
})
