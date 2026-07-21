/**
 * The color gate — three invariants the theme cannot express in types, only in measurements.
 *
 *  1. THE FILL BAND. A filled control does not invert across schemes, so its color must satisfy
 *     both pages at once while carrying a white label: ≥4.5:1 for the label, ≥3:1 against each
 *     page. That pins every fill into one narrow luminance window (see `FILL` / `ACCENT` in
 *     tokens/palette.ts). Untuned, five families sat below the page floor and three needed black
 *     labels.
 *
 *  2. SINGLE SOURCE. Mantine's chrome must read the `--vx-*` tokens, not its own JS hex ramp —
 *     otherwise the palette is dual-sourced, and retuning a token (in the theme lab, or anywhere)
 *     moves the charts while the buttons stay put. That was a real, shipped bug.
 *
 *  3. ON-COLOR. Mantine picks a filled surface's FOREGROUND in JS, once, via `parseThemeColor()`
 *     with no `colorScheme` — and via a BT.601 brightness heuristic that does not track WCAG
 *     contrast (it handed white to lime at 2.24:1). Basalt decides it in CSS instead, per scheme,
 *     by measurement.
 *
 * These are THEME-RESOLUTION invariants, not call-site patterns — no lint rule can see them; the
 * gate has to compute the two colors that actually meet on screen and measure them. The WCAG math
 * below is deliberately a SECOND, independent implementation: the theme is checked against the
 * standard, never against its own helper.
 */
import { DEFAULT_THEME, getPrimaryShade, mergeMantineTheme } from '@mantine/core'
import type { MantineTheme } from '@mantine/core'
import { describe, expect, test } from 'bun:test'
import { ACCENT, FILL, SURFACE } from '../tokens/palette'
import { baseTheme, cssVariablesResolver } from './index'

const theme: MantineTheme = mergeMantineTheme(DEFAULT_THEME, baseTheme)
const SCHEMES = ['light', 'dark'] as const
const COLORS = Object.keys(theme.colors)
const AA = 4.5 // WCAG 2.x AA, normal-size text

/** WCAG 2.x relative luminance. */
function relativeLuminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16)
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!
}

/** WCAG 2.x contrast ratio. */
function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].toSorted((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}

/** The hex a filled surface of `color` actually paints in `scheme`. */
function filledBackground(color: string, scheme: 'light' | 'dark'): string {
  return theme.colors[color]![getPrimaryShade(theme, scheme)]!
}

/** The `--vx-on-{color}` declaration the CSS-variables resolver emits for `scheme`. */
function onColorVar(color: string, scheme: 'light' | 'dark'): string {
  return cssVariablesResolver(theme)[scheme][`--vx-on-${color}`]!
}

/** The hex `--vx-on-{color}` ultimately resolves to. */
function onColorHex(color: string, scheme: 'light' | 'dark'): string {
  const declaration = onColorVar(color, scheme)
  if (color === theme.primaryColor) return ACCENT.onAccent[scheme]
  return declaration === 'var(--mantine-color-black)' ? theme.black : theme.white
}

describe('--vx-on-* is emitted for every theme color, in both schemes', () => {
  for (const scheme of SCHEMES) {
    test(scheme, () => {
      for (const color of COLORS) expect(onColorVar(color, scheme)).toBeDefined()
    })
  }
})

describe('the accent delegates to the palette, not to a computed guess', () => {
  // `ACCENT.onAccent` is the spec's declared "text on an accent fill" — the token stays the single
  // source (a palette retune must move the chrome with it), with a generated per-scheme fallback
  // for the `injectPalette={false}` window before the palette <style> lands.
  for (const scheme of SCHEMES) {
    test(scheme, () => {
      expect(onColorVar(theme.primaryColor, scheme)).toBe(
        `var(--vx-onAccent, ${ACCENT.onAccent[scheme]})`,
      )
    })
  }
})

describe('every filled surface is legible against its on-color', () => {
  // The floor is structural, not tuned: contrast(bg, white) * contrast(bg, black) is a constant
  // (~17.9 for this black), so always taking the larger of the two cannot drop below ~4.23.
  const FLOOR = 4.2

  for (const scheme of SCHEMES) {
    for (const color of COLORS) {
      test(`${color} / ${scheme}`, () => {
        const ratio = contrastRatio(filledBackground(color, scheme), onColorHex(color, scheme))
        expect(ratio).toBeGreaterThanOrEqual(FLOOR)
      })
    }
  }

  // The accent carries the primary CTA's label — it clears full AA in both schemes, and the light
  // accent hex is pinned to the depth that makes that true (see `ACCENT` in tokens/palette.ts).
  for (const scheme of SCHEMES) {
    test(`accent clears AA (${scheme})`, () => {
      const ratio = contrastRatio(
        filledBackground(theme.primaryColor, scheme),
        onColorHex(theme.primaryColor, scheme),
      )
      expect(ratio).toBeGreaterThanOrEqual(AA)
    })
  }

  // The accent is also a LINK/icon color on the bare page, not just a fill — same AA bar.
  test('accent is AA-legible as text on the light page', () => {
    expect(contrastRatio(ACCENT.accent.light, '#fafafa')).toBeGreaterThanOrEqual(AA)
  })
})

describe('every non-accent on-color is the higher-contrast of black/white', () => {
  // The exact property Mantine's brightness heuristic violates: it hands white to saturated
  // mid-tones (lime `#97ba2e` at 2.24:1) where black scores 7.91:1.
  for (const scheme of SCHEMES) {
    for (const color of COLORS.filter((c) => c !== theme.primaryColor)) {
      test(`${color} / ${scheme}`, () => {
        const background = filledBackground(color, scheme)
        const chosen = onColorHex(color, scheme)
        const rejected = chosen === theme.white ? theme.black : theme.white
        expect(contrastRatio(background, chosen)).toBeGreaterThanOrEqual(
          contrastRatio(background, rejected),
        )
      })
    }
  }
})

describe('the accent is split by role: ink inverts, surface does not', () => {
  const PAGE = { light: '#fafafa', dark: '#232326' }

  test('the accent SURFACE is the same hex in both schemes', () => {
    // It is squeezed from both sides (white text vs. the fill, and the fill vs. the page), and on
    // the dark page those constraints leave a single narrow window — the same one that works on
    // light. So the fill does NOT invert, and its label is white in both schemes.
    expect(filledBackground(theme.primaryColor, 'light')).toBe(
      filledBackground(theme.primaryColor, 'dark'),
    )
    expect(onColorHex(theme.primaryColor, 'light')).toBe(theme.white)
    expect(onColorHex(theme.primaryColor, 'dark')).toBe(theme.white)
  })

  test('the accent INK does invert — it is read against the page, not against a fill', () => {
    expect(ACCENT.accent.light).not.toBe(ACCENT.accent.dark)
    for (const scheme of SCHEMES) {
      expect(contrastRatio(ACCENT.accent[scheme], PAGE[scheme])).toBeGreaterThanOrEqual(AA)
    }
  })

  for (const scheme of SCHEMES) {
    test(`the accent surface stays visible AGAINST the ${scheme} page`, () => {
      // The reason the fill is not simply darkened until white text is comfortable: at 3:1 (WCAG
      // non-text) the control must be distinguishable from the page. Darkening the fill further
      // buys white-text contrast but can drop this ratio below 3 — a button fading into the
      // background.
      const ratio = contrastRatio(filledBackground(theme.primaryColor, scheme), PAGE[scheme])
      expect(ratio).toBeGreaterThanOrEqual(3)
    })
  }

  test('a hovered accent surface keeps its white label legible', () => {
    expect(contrastRatio(ACCENT.accentFillHover.dark, theme.white)).toBeGreaterThanOrEqual(AA)
  })
})

describe('THE FILL BAND: every filled surface reads white, on either page', () => {
  // The law that replaces per-color judgement (see FILL in tokens/palette.ts). A fill does not
  // invert across schemes, so it must satisfy BOTH pages at once, while carrying a white label:
  //   white label ≥ 4.5:1 against the fill   → luminance ≤ 0.183
  //   control     ≥ 3.0:1 against each page  → luminance ≥ 0.150 (the dark page is the binding one)
  // Untuned, five families sat under the page floor (grape 2.17:1) and three needed black labels.
  const PAGE = { light: '#fafafa', dark: '#232326' }
  const BAND = Object.keys(FILL).concat(theme.primaryColor)

  for (const color of BAND) {
    const fill = filledBackground(color, 'light')

    test(`${color}: white label clears AA`, () => {
      expect(onColorHex(color, 'light')).toBe(theme.white)
      expect(onColorHex(color, 'dark')).toBe(theme.white)
      expect(contrastRatio(fill, theme.white)).toBeGreaterThanOrEqual(AA)
    })

    test(`${color}: visible against BOTH pages`, () => {
      for (const scheme of SCHEMES) {
        expect(contrastRatio(fill, PAGE[scheme])).toBeGreaterThanOrEqual(3)
      }
    })

    test(`${color}: the JS ramp and the --vx-fill-* token agree`, () => {
      // Shade 6 is pinned to the band hex, so `-outline` / light `-text` (which read the ramp)
      // cannot drift away from the fill the CSS token paints.
      expect(filledBackground(color, 'dark')).toBe(fill)
    })
  }
})

describe('the accent is single-sourced: Mantine chrome is bridged to --vx-*', () => {
  for (const scheme of SCHEMES) {
    test(`every non-primary family bridges its fill (${scheme})`, () => {
      const vars = cssVariablesResolver(theme)[scheme]
      for (const [name, hex] of Object.entries(FILL)) {
        expect(vars[`--mantine-color-${name}-filled`]).toBe(`var(--vx-fill-${name}, ${hex})`)
        expect(vars[`--mantine-color-${name}-filled-hover`]).toContain(
          `var(--vx-fillHover-${name},`,
        )
      }
    })
  }

  // Why the theme lab looked broken: the accent was DUAL-SOURCED. The `--vx-*` layer drove charts
  // and links; Mantine's chrome drove buttons off a JS hex ramp that pointed at nothing. Overriding
  // `--vx-accent` restyled the charts and left every button untouched. These lock the bridge.
  for (const scheme of SCHEMES) {
    test(`the filled surface resolves through --vx-accentFill (${scheme})`, () => {
      const vars = cssVariablesResolver(theme)[scheme]
      // `getThemeColor()` resolves any plain theme color to `-filled`, so this ONE var reaches the
      // variant resolver AND every component that fills from its own varsResolver.
      expect(vars[`--mantine-color-${theme.primaryColor}-filled`]).toBe(
        `var(--vx-accentFill, ${ACCENT.accentFill[scheme]})`,
      )
      expect(vars[`--mantine-color-${theme.primaryColor}-filled-hover`]).toBe(
        `var(--vx-accentFillHover, ${ACCENT.accentFillHover[scheme]})`,
      )
    })

    test(`the ink roles resolve through --vx-accent (${scheme})`, () => {
      const vars = cssVariablesResolver(theme)[scheme]
      for (const role of ['text', 'outline', 'light-color']) {
        expect(vars[`--mantine-color-${theme.primaryColor}-${role}`]).toBe(
          `var(--vx-accent, ${ACCENT.accent[scheme]})`,
        )
      }
    })
  }
})

describe('the variant resolver hands off to CSS, never to a baked color', () => {
  const resolve = (color: string) =>
    theme.variantColorResolver({ color, theme, variant: 'filled', gradient: undefined })

  for (const color of COLORS) {
    test(`filled ${color} resolves to var(--vx-on-${color})`, () => {
      const { color: foreground } = resolve(color)
      // The bug in one assertion: a scheme-blind literal here is unreadable in one of the schemes.
      expect(foreground).not.toBe('var(--mantine-color-white)')
      expect(foreground).toBe(`var(--vx-on-${color})`)
    })
  }

  test('an indexed color keeps the Mantine default — its fill is scheme-static', () => {
    expect(resolve('blue.9').color).toBe('var(--mantine-color-white)')
  })

  test('a raw hex keeps the Mantine default — nothing to resolve per scheme', () => {
    expect(resolve('#ff0000').color).toBe('var(--mantine-color-white)')
  })

  test('autoContrast:false at the call site is still honored', () => {
    const { color } = theme.variantColorResolver({
      color: 'blue',
      theme,
      variant: 'filled',
      gradient: undefined,
      autoContrast: false,
    })
    expect(color).toBe('var(--mantine-color-white)')
  })
})

describe('doctrine inversion #1 reaches every default-variant CONTROL, not just Card/Paper', () => {
  // `defaultVariantColorsResolver`'s `variant === 'default'` branch draws its border from this ONE
  // var (`border: 1px solid var(--mantine-color-default-border)`) for every component that uses
  // it — Button, ActionIcon, Chip, CheckboxCard, RadioCard, … A future edit that re-points this at
  // a hairline token would silently reintroduce the stock 1px border on all of them at once; this
  // is the seam that catches it, since none of those components render their border any other way.
  for (const scheme of SCHEMES) {
    test(`--mantine-color-default-border is transparent (${scheme})`, () => {
      const vars = cssVariablesResolver(theme)[scheme]
      expect(vars['--mantine-color-default-border']).toBe('transparent')
    })
  }

  test('a default-variant control resolves through the transparent border, not a hairline', () => {
    // The variant resolver itself doesn't special-case `default` (see the `basaltVariantColorResolver`
    // early return above) — it hands off to `defaultVariantColorsResolver`, which is what actually
    // reads the var. Assert the var is what a `default`-variant Button/ActionIcon border resolves
    // through, closing the loop from token to the real render-path seam.
    const { border } = theme.variantColorResolver({
      color: theme.primaryColor,
      theme,
      variant: 'default',
      gradient: undefined,
    })
    expect(border).toContain('solid var(--mantine-color-default-border)')
    expect(border).not.toContain('surface-border')
  })
})

describe('the shipped palette is the generator output at DEFAULT_DERIVE_CONFIG', () => {
  // A handful of exact hexes from `deriveTokens(DEFAULT_DERIVE_CONFIG)` (`tokens/derive.ts`) — the
  // shipped default identity (seed #0077bd, zinc, all four knobs at level 0). Drift here means
  // either the derive constants moved or `palette.ts` stopped reading the generator's output.
  test('accentFill (light + dark, same hex)', () => {
    expect(ACCENT.accentFill.light).toBe('#4374a6')
    expect(ACCENT.accentFill.dark).toBe('#4374a6')
  })

  test('surface-bg', () => {
    expect(SURFACE.bg.light).toBe('#f2f2f5')
    expect(SURFACE.bg.dark).toBe('#27272a')
  })
})
