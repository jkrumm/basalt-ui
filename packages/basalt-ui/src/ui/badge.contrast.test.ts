/**
 * The delta pill's text against its own tint, measured from the derived palette at the default
 * config, in both schemes, on the inset (where the stat card draws it) and on the card. The table
 * names every measured ratio; a palette retune that moves one fails here with the new value, and
 * no ratio may fall under 4.5:1.
 *
 * The tint is composited the way the CSS paints it: `--color-<tone>-tint` is
 * `color-mix(in srgb, var(--basalt-<tone>) var(--basalt-tint-pct), transparent)` over the surface, and the
 * neutral pill is the primary ink on `--basalt-selected` (ink at `INK_MIX_PCT.selected`) over the surface.
 */
import { describe, expect, test } from 'bun:test'
import { DEFAULT_DERIVE_V3_CONFIG, INK_MIX_PCT, TINT_PCT, deriveV3, mixHex } from '../tokens/derive'
import { contrastRatio } from '../tokens/hct'
import { deltaBadgeVariants } from './badge'

type Scheme = 'light' | 'dark'
type Surface = 'canvas' | 'inset' | 'card'
type Tone = 'good' | 'bad' | 'neutral'

/** Measured ratios, to three decimals. */
const MEASURED: Record<Scheme, Record<Surface, Record<Tone, number>>> = {
  light: {
    canvas: { good: 4.541, bad: 4.549, neutral: 11.462 },
    inset: { good: 4.541, bad: 4.549, neutral: 11.462 },
    card: { good: 4.804, bad: 4.819, neutral: 12.123 },
  },
  dark: {
    canvas: { good: 5.643, bad: 5.608, neutral: 9.302 },
    inset: { good: 5.643, bad: 5.608, neutral: 9.302 },
    card: { good: 4.905, bad: 4.874, neutral: 7.972 },
  },
}

const derived = deriveV3(DEFAULT_DERIVE_V3_CONFIG)

function measure(scheme: Scheme, surface: Surface, tone: Tone): number {
  const bg = derived.colors[surface][scheme]
  if (tone === 'neutral') {
    const tint = mixHex(bg, derived.colors.ink[scheme], INK_MIX_PCT.selected[scheme] / 100)
    return contrastRatio(derived.colors.ink[scheme], tint)
  }
  const ink = derived.colors[tone][scheme]
  return contrastRatio(ink, mixHex(bg, ink, TINT_PCT[scheme] / 100))
}

describe('delta pill contrast', () => {
  test('the pill paints the measured pairs: tone ink on tone tint, primary ink on selected', () => {
    expect(deltaBadgeVariants({ tone: 'good' })).toContain('bg-good-tint text-good')
    expect(deltaBadgeVariants({ tone: 'bad' })).toContain('bg-bad-tint text-bad')
    expect(deltaBadgeVariants({ tone: 'neutral' })).toContain('bg-selected text-foreground')
  })

  for (const scheme of ['light', 'dark'] as const)
    for (const surface of ['canvas', 'inset', 'card'] as const)
      for (const tone of ['good', 'bad', 'neutral'] as const) {
        const named = MEASURED[scheme][surface][tone]
        test(`${tone} on ${surface}, ${scheme}: ${named.toFixed(2)}:1, at least 4.5:1`, () => {
          const ratio = measure(scheme, surface, tone)
          expect(ratio).toBeCloseTo(named, 2)
          expect(ratio).toBeGreaterThanOrEqual(4.5)
        })
      }
})
