/**
 * The hard-won token laws, pinned on the 2.x modules BEFORE the v3 table rewrite (docs/v3
 * `tokens-visual.md` §5 "Invariants pinned in a test before the port", §12 T1). Each id is the
 * number of the law in `docs/v3/evidence/self-tokens-theme.md` §(d); one test per id, the id first.
 *
 * - An active test pins a law the 2.x code already implements. Each was shown to FAIL against a
 *   one-line mutation of the law it names (listed in the Issue's PR body), so none is vacuous.
 * - A `test.todo` pins a law whose v3 form does not exist yet and names the Issue that makes it
 *   real: tok-t2 (table, derive, gates, emit), tok-t3 (CSS entries, fonts, scheme module),
 *   tok-t4 (CLI, lint, `check-tokens`).
 *
 * The 2.x forms are the baseline the port must keep honest; where v3 changes the SHAPE of a law
 * (hairline as an ink alpha, a `Card` with no `border`, tenant specificity 0-3-0) the rewrite
 * replaces the matching test, it does not delete it.
 */
import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { normalizeColorFunctions, tokensCss } from '../cli/tokens-css'
import { GENERATED_HEADER_LINE, REMOVED_VX_NAMES } from '../guard'
import { buildPaletteCss, seriesTokens, VX } from './core'
import {
  DEFAULT_DERIVE_CONFIG,
  DEFAULT_DERIVE_V3_CONFIG,
  deriveTokens,
  deriveV3,
  INK_MIX_PCT,
  statusBackgrounds,
} from './derive'
import type { DeriveConfig, DeriveV3Config, FillFamily, SurfaceKey } from './derive'
import { emitTokensCss } from './emit'
import { PAIRS } from './gates'
import { FOREGROUND_PAIRS } from './table'
import { contrastRatio, relativeLuminance } from './hct'
import { buildPaletteData, SHADOW } from './palette'
import { deriveStatusHexes, STATUS_TEXT_SURFACES } from './status-text'

/** Body of a `test.todo`: bun's types require one, and it only runs under `--todo`. */
const pending = (): void => {}

const TOKENS_DIR = import.meta.dir
const SRC_DIR = join(TOKENS_DIR, '..')
const stylesCss = readFileSync(join(SRC_DIR, 'styles.css'), 'utf8')

const SIDES = ['light', 'dark'] as const
const NEUTRALS: readonly DeriveConfig['neutral'][] = ['zinc', 'neutral', 'stone', 'slate']
const LEVELS = [-5, 0, 5] as const
/** Hues spread around the wheel plus a pale one (the seed contributes hue only). */
const SEEDS = ['#0077bd', '#d62828', '#2a9d3f', '#e0c000', '#8e44ad', '#ff7a00', '#9ad000']

const TEXT_SURFACES = (Object.keys(STATUS_TEXT_SURFACES) as SurfaceKey[]).filter(
  (key) => STATUS_TEXT_SURFACES[key],
)

/** Every config on the grid: seeds x neutrals x surface levels (both schemes together). */
function* surfaceGrid(): Generator<DeriveConfig> {
  for (const accent of SEEDS)
    for (const neutral of NEUTRALS)
      for (const level of LEVELS)
        yield { ...DEFAULT_DERIVE_CONFIG, accent, neutral, lightLevel: level, darkLevel: level }
}

const V3_NEUTRALS: readonly DeriveV3Config['neutral'][] = ['zinc', 'neutral', 'stone', 'slate']
const V3_VIBRANCY = [-4, 0, 5] as const

/** Every v3 config on the grid: seeds x neutrals x vibrancy. */
function* v3Grid(): Generator<DeriveV3Config> {
  for (const accent of SEEDS)
    for (const neutral of V3_NEUTRALS)
      for (const vibrancy of V3_VIBRANCY) yield { accent, neutral, vibrancy }
}

/** Specificity (b column only: the emitted selectors carry no ids and no elements) of one selector. */
function specificity(selector: string): number {
  const flat = selector.replaceAll(/:not\(|\)/g, ' ')
  return (flat.match(/\[[^\]]+\]/g)?.length ?? 0) + (flat.match(/:root/g)?.length ?? 0)
}

const FILL_FAMILIES = Object.keys(deriveTokens(DEFAULT_DERIVE_CONFIG).fill) as FillFamily[]

describe('token invariants (docs/v3/evidence/self-tokens-theme.md §d)', () => {
  test('d1 fill band: every fill sits at Y=.165, so a white label clears 4.5:1 and the fill 3:1 on both pages', () => {
    for (const config of surfaceGrid()) {
      const palette = deriveTokens(config)
      for (const family of FILL_FAMILIES) {
        const fill = palette.fill[family].light
        // Hex quantisation moves Y by a hair; the band is a luminance, not a hex.
        expect(Math.abs(relativeLuminance(fill) - 0.165)).toBeLessThan(0.012)
        expect(contrastRatio(fill, '#ffffff')).toBeGreaterThanOrEqual(4.5)
        // The page half of the law holds at the shipped surface levels; an extreme level moves the page itself.
        if (config.lightLevel !== 0) continue
        for (const side of SIDES) {
          expect(contrastRatio(fill, palette.surface.bg[side])).toBeGreaterThanOrEqual(3)
        }
      }
    }
  })

  test('d3 clampFillTone: an accent fill shifted by accentBrightness still clears 3:1 on BOTH pages', () => {
    for (const accent of SEEDS)
      for (const accentBrightness of [-5, -3, 3, 5]) {
        const palette = deriveTokens({ ...DEFAULT_DERIVE_CONFIG, accent, accentBrightness })
        for (const side of SIDES) {
          expect(
            contrastRatio(palette.accentFill.light, palette.surface.bg[side]),
          ).toBeGreaterThanOrEqual(3)
        }
      }
  })

  test('v3 fill: the brand fill clears 3:1 on every allowed surface (canvas, inset) and its label 4.5:1, over the whole grid', () => {
    for (const config of v3Grid()) {
      const { colors } = deriveV3(config)
      for (const side of SIDES) {
        for (const surface of ['canvas', 'inset'] as const) {
          expect(
            contrastRatio(colors['brand-fill'][side], colors[surface][side]),
          ).toBeGreaterThanOrEqual(3)
        }
        expect(
          contrastRatio(colors['on-brand'][side], colors['brand-fill'][side]),
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
    // The card is deliberately not an allowed surface: the dark card puts the fill at 2.61 there.
    expect(PAIRS.some((row) => row.gate === 'fill-on-card')).toBe(false)
  })

  test('d5 status solver: every status solid clears 4.5:1 on every text surface, and an unreachable tone throws', () => {
    for (const config of surfaceGrid()) {
      const palette = deriveTokens(config)
      for (const key of ['good', 'warn', 'bad'] as const)
        for (const side of SIDES)
          for (const surface of TEXT_SURFACES) {
            expect(
              contrastRatio(palette.status[key][side], palette.surface[surface][side]),
            ).toBeGreaterThanOrEqual(4.5)
          }
    }

    // A mid-grey text surface: darkening can never reach 4.5:1 on it, so the walk must run out and throw.
    const mid = { light: '#5a5a5a', dark: '#5a5a5a' }
    const surfaces = Object.fromEntries(
      Object.keys(STATUS_TEXT_SURFACES).map((key) => [key, mid]),
    ) as Record<SurfaceKey, typeof mid>
    expect(() => deriveStatusHexes(surfaces)).toThrow(/no light good tone reaches 4\.5:1/)
  })

  test('v3 status solver: the grid includes selected, hover and the ink own tint, and every ink clears 4.5:1 on all of them', () => {
    for (const config of v3Grid()) {
      const { colors } = deriveV3(config)
      for (const side of SIDES) {
        const surfaces = {
          canvas: colors.canvas[side],
          inset: colors.inset[side],
          card: colors.card[side],
          raised: colors.raised[side],
        }
        for (const tone of ['good', 'warn', 'bad', 'info'] as const) {
          const backgrounds = statusBackgrounds({
            side,
            surfaces,
            ink: colors.ink[side],
            tone: colors[tone][side],
          })
          const labels = backgrounds.map((b) => b.surface)
          expect(labels).toEqual(
            expect.arrayContaining(['hover-card', 'selected-inset', 'tint-card']),
          )
          for (const bg of backgrounds) {
            expect(contrastRatio(colors[tone][side], bg.hex)).toBeGreaterThanOrEqual(4.5)
          }
        }
      }
    }
  })

  test('d6 faint opaque axis: axis is the derived opaque faint ink, 4.5:1 on every text surface', () => {
    for (const config of surfaceGrid()) {
      const { NEUTRAL, INK, SURFACE } = buildPaletteData(config)
      expect(NEUTRAL.axis).toEqual(INK.faint)
      for (const side of SIDES) {
        expect(NEUTRAL.axis[side]).toMatch(/^#[0-9a-f]{6}$/i)
        // The contrast floor is the shipped-level claim; an extreme level moves the surfaces under it.
        if (config.lightLevel !== 0) continue
        for (const surface of TEXT_SURFACES) {
          expect(contrastRatio(NEUTRAL.axis[side], SURFACE[surface][side])).toBeGreaterThanOrEqual(
            4.5,
          )
        }
      }
    }
  })

  test('d7 divider is an ink alpha, not a hex: 9% of the derived ink (light), 8% white (dark)', () => {
    for (const neutral of NEUTRALS)
      for (const lightLevel of LEVELS) {
        const { SURFACE, INK } = buildPaletteData({ ...DEFAULT_DERIVE_CONFIG, neutral, lightLevel })
        const ink = INK.ink.light
        const rgb = [1, 3, 5].map((i) => Number.parseInt(ink.slice(i, i + 2), 16)).join(', ')
        expect(SURFACE.divider.light).toBe(`rgba(${rgb}, 0.09)`)
        expect(SURFACE.divider.dark).toBe('rgba(255, 255, 255, 0.08)')
      }
    // Three line tokens, three roles: the seam, the card ring and the control edge never share a value.
    const { SURFACE } = buildPaletteData()
    for (const side of SIDES) {
      expect(
        new Set([SURFACE.divider[side], SURFACE.hairline[side], SURFACE.border[side]]).size,
      ).toBe(3)
    }
  })

  test('v3 hairline: --hairline is an ink alpha (the 2.x divider, 9% both schemes) and the ring is drawn once, by Card::after', () => {
    const css = emitTokensCss({ version: '3.0.0' })
    expect(css).toContain(
      `--vx-hairline: color-mix(in srgb, var(--vx-ink) ${INK_MIX_PCT.hairline.light}%, transparent);`,
    )
    expect(css).toContain(
      `--vx-hairline: color-mix(in srgb, var(--vx-ink) ${INK_MIX_PCT.hairline.dark}%, transparent);`,
    )
    // No shadow role embeds the hairline or an outset 1px ring: a second ring is a second edge (d8).
    expect(css).not.toMatch(/--vx-shadow-[a-z]+:[^;]*var\(--vx-hairline\)/)
    for (const [, value] of css.matchAll(/--vx-shadow-card: ([^;]+);/g)) {
      expect(value).not.toMatch(/0 0 0 1px/)
    }
    // The input boundary is a deliberate heavier line, never a scaled hairline (S3).
    expect(INK_MIX_PCT.input.light).toBeGreaterThan(INK_MIX_PCT.hairline.light * 3)
    expect(INK_MIX_PCT.input.dark).toBeGreaterThan(INK_MIX_PCT.hairline.dark * 3)
  })

  test('d8 one edge per surface: the card ring lives inside the card shadow and the control shadow draws none', () => {
    expect(SHADOW.card.light).toContain('0 0 0 1px var(--vx-surface-hairline)')
    expect(SHADOW.card.dark).toContain('inset 0 0 0 1px')
    for (const side of SIDES) {
      expect(SHADOW.ctrl[side]).not.toMatch(/inset|0 0 0 1px/)
    }
    const css = buildPaletteCss()
    expect(css).toContain(`--vx-shadow-card: ${SHADOW.card.dark}`)
    expect(css).toContain(`--vx-shadow-card: ${SHADOW.card.light}`)
  })

  test.todo('v3 card: Card carries no border, the src/ui scan finds none (tok-t4)', pending)

  test('d9 raised shadow stays asymmetric: light is one drop and no edge, dark is a drop plus an inset rim', () => {
    expect(SHADOW.raised.light).toBe('0 1px 2px rgba(28, 25, 23, 0.1)')
    expect(SHADOW.raised.dark).toBe(
      '0 1px 2px rgba(0, 0, 0, 0.35), inset 0 0 0 1px color-mix(in srgb, #ffffff 8%, transparent)',
    )
    expect(SHADOW.raised.light).not.toContain('inset')
    const css = buildPaletteCss()
    expect(css).toContain(`--vx-shadow-raised: ${SHADOW.raised.light}`)
    expect(css).toContain(`--vx-shadow-raised: ${SHADOW.raised.dark}`)
  })

  test('d10 scheme selector specificity: a custom attribute emits :root[attr] (0-2-0), the default path keeps html[attr]', () => {
    const custom = buildPaletteCss({ scheme: { attribute: 'data-theme' } })
    expect(custom).toContain(":root[data-theme='dark']")
    expect(custom).toContain(":root[data-theme='light']")
    expect(custom).not.toMatch(/^html\[/m)
    const legacy = buildPaletteCss()
    expect(legacy).toContain("html[data-mantine-color-scheme='light']")
    expect(legacy).not.toContain(':root[')
  })

  test('v3 tenant: an override at 0-3-0 beats the default at 0-2-0', () => {
    const preludes = (css: string): string[] =>
      [...css.replaceAll(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)]
        .map((m) => m[1]!.trim())
        .filter((prelude) => !prelude.startsWith('@'))
        .flatMap((prelude) => prelude.split(','))
        .map((selector) => selector.trim())
    const base = emitTokensCss({ version: '3.0.0' })
    const defaults = [...base.matchAll(/([^{}]+)\{\s*color-scheme/g)].flatMap((m) =>
      m[1]!.split(',').map((selector) => selector.trim()),
    )
    expect(Math.max(...defaults.map(specificity))).toBe(2)

    const tenant = emitTokensCss({
      version: '3.0.0',
      selector: ":root[data-tenant='t2']",
      config: { accent: '#0f8a7e' },
    })
    const selectors = preludes(tenant)
    expect(selectors.length).toBeGreaterThanOrEqual(4)
    for (const selector of selectors) expect(specificity(selector)).toBe(3)
    expect(() => emitTokensCss({ version: '3.0.0', selector: '.tenant' })).toThrow(/:root\[/)
  })

  test.todo('d12 layer statement first: no basalt rule is unlayered (tok-t3)', pending)

  test('d13 iOS floor: inputs get font-size max(16px, ...) and it is !important, and lg is the 16px rung', () => {
    const rule = stylesCss.match(
      /input\s*,\s*\n?\s*select\s*,\s*\n?\s*textarea\s*\{\s*\n?\s*font-size:\s*([^;]+);/,
    )
    expect(rule).not.toBeNull()
    expect(rule?.[1]).toContain('max(var(--basalt-input-fz-floor, 16px)')
    expect(rule?.[1]).toContain('!important')
    expect(VX.text.lg).toBe(16)
  })

  test('d14 pointer tier: the hit floor is coarse (primary pointer), never any-pointer, and the overlay is ::after', () => {
    const css = buildPaletteCss()
    expect(css).toContain('@media (pointer: coarse) {\n  :root {\n    --vx-hit: 44px;')
    expect(css).toContain('--vx-hit: 24px')
    expect(css).not.toContain('any-pointer')
    expect(stylesCss).not.toMatch(/@media[^{]*any-pointer/)
    expect(stylesCss).toMatch(/\[data-basalt-hit\][^{]*::after\s*\{/)
    expect(stylesCss).not.toMatch(/\[data-basalt-hit\][^{]*::before\s*\{/)
  })

  test('d17 type ladder: UI rungs sit 1.06-1.17x apart, lg is 16, and no 20px rung exists', () => {
    const rungs = Object.values(VX.text)
    const ui = rungs.filter((size) => size <= VX.text.xl)
    for (let i = 1; i < ui.length; i++) {
      const ratio = ui[i]! / ui[i - 1]!
      expect(ratio).toBeGreaterThanOrEqual(1.06)
      expect(ratio).toBeLessThanOrEqual(1.17)
    }
    expect(VX.text.lg).toBe(16)
    expect(rungs).not.toContain(20)
  })

  test.todo('d18 head digits, 88% stretch on Hubot only, numerals (tok-t3, fonts.css)', pending)

  test.todo('d19 mono data text drops ligatures (tok-t3, fonts.css)', pending)

  test('d20 autofill: paints an inset 100vmax shadow in the field surface plus a 600000s transition', () => {
    const block = stylesCss.match(/input:-webkit-autofill,[\s\S]*?\{([^}]*)\}/)?.[1] ?? ''
    expect(block).toContain('box-shadow: 0 0 0 100vmax var(--vx-surface-field) inset')
    expect(block).toContain('transition: background-color 600000s 0s')
  })

  test('d21 focus ring is accent as ink, not the fill: the outline reads --vx-accent and dark ink clears 4.5:1', () => {
    const rule =
      stylesCss.match(/\.mantine-focus-auto:focus-visible,[\s\S]*?\{([^}]*)\}/)?.[1] ?? ''
    expect(rule).toMatch(/outline-color:\s*var\(--vx-accent\);/)
    expect(rule).not.toContain('accent-fill')
    for (const config of surfaceGrid()) {
      const palette = deriveTokens(config)
      expect(contrastRatio(palette.accent.dark, palette.surface.bg.dark)).toBeGreaterThanOrEqual(
        4.5,
      )
    }
  })

  test('d25 dev gating: the dev check sits behind a literal NODE_ENV read, so production does not throw and dev does', () => {
    const core = readFileSync(join(TOKENS_DIR, 'core.ts'), 'utf8')
    expect(core).toMatch(/if \(process\.env\.NODE_ENV !== 'production'\) assertConsumerVxName\(/)
    expect(core).not.toMatch(/\bisDev\s*\(/)

    const previous = process.env.NODE_ENV
    try {
      process.env.NODE_ENV = 'development'
      expect(() => seriesTokens({ bg: { light: 'x', dark: 'x' } }, 'surface-')).toThrow(
        /basalt's own --vx-surface family/,
      )
      process.env.NODE_ENV = 'production'
      expect(() => seriesTokens({ bg: { light: 'x', dark: 'x' } }, 'surface-')).not.toThrow()
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV
      else process.env.NODE_ENV = previous
    }
  })

  test('d26 layering: ./tokens imports nothing but relative modules, so it resolves with no Mantine or React', () => {
    const offenders: string[] = []
    for (const file of readdirSync(TOKENS_DIR).filter(
      (f) => f.endsWith('.ts') && !f.includes('.test.'),
    )) {
      const source = readFileSync(join(TOKENS_DIR, file), 'utf8')
      for (const m of source.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)) {
        if (!m[1]!.startsWith('.')) offenders.push(`${file}: ${m[1]}`)
      }
    }
    expect(offenders).toEqual([])
  })

  test('d28 unknown vars fail silently, so the emitted names are kebab-case and every removed alias is absent', () => {
    const css = buildPaletteCss({ only: 'all' })
    const emitted = new Set([...css.matchAll(/(--vx-[\w-]+)\s*:/g)].map((m) => m[1]!))
    expect(emitted.size).toBeGreaterThan(50)
    for (const name of emitted) expect(name).toMatch(/^--vx-[a-z0-9-]+$/)
    for (const [removed, replacement] of Object.entries(REMOVED_VX_NAMES)) {
      expect(emitted.has(removed)).toBe(false)
      if (replacement !== null) expect(emitted.has(replacement)).toBe(true)
    }
    expect(REMOVED_VX_NAMES['--vx-goodSolid']).toBe('--vx-good-solid')
  })

  test('d30 generated stylesheet contract: line 1 is the marker, line 2 the provenance, color args formatter-stable', () => {
    expect(GENERATED_HEADER_LINE).toBe(
      '/* @generated basalt-ui — do not edit; regenerate with the command on the next line */',
    )
    const dir = mkdtempSync(join(tmpdir(), 'basalt-invariants-'))
    try {
      expect(tokensCss(['--out', 'tokens.css'], dir)).toBe(0)
      const [line1, line2] = readFileSync(join(dir, 'tokens.css'), 'utf8').split('\n')
      expect(line1).toBe(GENERATED_HEADER_LINE)
      expect(line2).toMatch(/^\/\* basalt-ui \S+ — `basalt-ui tokens:css --out tokens\.css` \*\/$/)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
    expect(normalizeColorFunctions('rgba(255,255,255,0.60)')).toBe('rgba(255, 255, 255, 0.6)')
  })

  test('d33 foreground is a paired token: onAccent is measured against its fill, 3:1 everywhere, 4.5:1 at the default', () => {
    for (const config of surfaceGrid())
      for (const accentBrightness of [-5, 0, 5]) {
        const palette = deriveTokens({ ...config, accentBrightness })
        for (const side of SIDES) {
          expect(
            contrastRatio(palette.onAccent[side], palette.accentFill[side]),
          ).toBeGreaterThanOrEqual(3)
        }
      }
    const palette = deriveTokens(DEFAULT_DERIVE_CONFIG)
    expect(palette.onAccent.light).toBe('#ffffff')
    expect(contrastRatio(palette.onAccent.light, palette.accentFill.light)).toBeGreaterThanOrEqual(
      4.5,
    )
  })

  test('v3 foreground: every PAIRS *-foreground clears its fill, both schemes, over the grid', () => {
    const foregroundGates = PAIRS.filter((row) => row.foreground)
    expect(foregroundGates.map((row) => row.gate)).toEqual([
      'on-brand-on-fill',
      'primary-foreground-on-primary',
    ])
    expect(FOREGROUND_PAIRS).toHaveLength(foregroundGates.length)
    for (const config of v3Grid()) {
      const derived = deriveV3(config)
      for (const row of foregroundGates)
        for (const side of SIDES) expect(row.measure(derived, side)).toBeGreaterThanOrEqual(row.min)
    }
    expect(deriveV3(DEFAULT_DERIVE_V3_CONFIG).colors['on-brand'].light).toBe('#ffffff')
  })

  test.todo('bridge: shadcn aliases cover every semantic token, no dark: branch (tok-t3)', pending)

  test.todo('check-tokens scan: src/ui has no raw colour, no /NN alpha (tok-t4)', pending)
})
