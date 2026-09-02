/**
 * The default `buildPaletteCss()` output, held to structural invariants rather than a committed
 * byte-for-byte fixture.
 *
 * `--vx-*` CSS is the framework's widest contract: the Mantine theme, every CSS module, every
 * chart, and (since the framework-free work) a non-React consumer that ships the emitted string
 * directly all read the same variable set. A byte-snapshot caught any drift, including cosmetic
 * whitespace, at the cost of a fixture (`tests/fixtures/palette-default.css`) that had to be
 * regenerated and reviewed as a diff on every intentional change — the assertions below check the
 * properties that actually matter instead: every scheme declares the same variable set in the same
 * order, and the emitter never invents a color the palette data does not already carry.
 *
 * Run: bun test packages/basalt-ui/tests/palette-css.test.ts
 */
import { describe, expect, it } from 'bun:test'
import { buildPaletteCss } from '../src/tokens'
import { buildPaletteData, SPACE, SPACE_STEP } from '../src/tokens/palette'

/** Every `--vx-*` NAME declared inside the block a selector opens, in source order (dupes kept). */
function namesInBlock(css: string, selector: string): string[] {
  const start = css.indexOf(`${selector} {`)
  expect(start).toBeGreaterThanOrEqual(0)
  const end = css.indexOf('\n}', start)
  return [...css.slice(start, end).matchAll(/--vx-([\w-]+):/g)].map((m) => m[1] as string)
}

// A handful of fixed structural literals the emitter uses directly (never sourced from the derived
// palette data) — shadow black at varying alpha is the one legitimate case today.
const NON_PALETTE_HEX = new Set(['#000'])

describe('buildPaletteCss default output', () => {
  const css = buildPaletteCss()

  it('keeps the legacy `html[data-mantine-color-scheme]` selectors on the default path', () => {
    // The default output tracks Mantine's own toggle attribute on <html>, at 0-1-1 specificity.
    // Consumers override basalt vars under that same selector; raising it (to `:root[…]`, 0-2-0)
    // would silently win over their override. The custom-selector path emits `:root[…]` instead —
    // see `BuildPaletteOpts.scheme`.
    expect(css).toContain("html[data-mantine-color-scheme='dark']")
    expect(css).toContain("html[data-mantine-color-scheme='light']")
    expect(css).not.toContain(':root[')
  })

  it('declares the SAME --vx-* names, in the SAME order, under both scheme blocks', () => {
    const dark = namesInBlock(css, "html[data-mantine-color-scheme='dark']")
    const light = namesInBlock(css, "html[data-mantine-color-scheme='light']")
    expect(dark.length).toBeGreaterThan(0)
    expect(light).toEqual(dark)
  })

  it('is deterministic — two calls at the same config emit the same variable order', () => {
    const names = (s: string) => [...s.matchAll(/--vx-([\w-]+):/g)].map((m) => m[1])
    expect(names(buildPaletteCss())).toEqual(names(css))
  })

  it('never emits a hex literal the derived palette data does not already carry', () => {
    // Proves the emitter sources every color from buildPaletteData() rather than hand-inventing
    // one — a raw hex slipping into the CSS-assembly code itself would be invisible to the theme
    // guard, which only scans TSX/CSS-module source, not this package's own emitted string.
    const paletteJson = JSON.stringify(buildPaletteData())
    const hexes = new Set([...css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0]))
    for (const hex of hexes) {
      if (NON_PALETTE_HEX.has(hex)) continue
      expect([hex, paletteJson.includes(hex)]).toEqual([hex, true])
    }
  })

  it('stays on the legacy shape for the options that do not touch the selector', () => {
    expect(buildPaletteCss({ groups: {}, derived: [] })).toBe(css)
  })
})

/** Every `--vx-*` name declared inside the block a selector opens, in source order. */
function blockOf(css: string, selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf('\n}', start))
}

describe('buildPaletteCss color-scheme selector', () => {
  it('switches to `:root[…]` and honours a custom attribute', () => {
    const css = buildPaletteCss({ scheme: { attribute: 'data-theme' } })
    expect(css).toContain(":root[data-theme='dark']")
    expect(css).toContain(":root[data-theme='light']")
    expect(css).not.toContain('html[')
  })

  it('honours custom attribute VALUES', () => {
    const css = buildPaletteCss({ scheme: { attribute: 'data-mode', darkValue: 'night' } })
    expect(css).toContain(":root[data-mode='night']")
    // An unset value keeps its default rather than inheriting the other one.
    expect(css).toContain(":root[data-mode='light']")
  })

  it("defaults to Mantine's attribute at `:root` specificity when only `defaultScheme` is set", () => {
    const css = buildPaletteCss({ defaultScheme: 'light' })
    expect(css).toContain(":root[data-mantine-color-scheme='light']")
    expect(css).not.toContain('html[')
  })

  it('`defaultScheme: "light"` puts light on the bare `:root`', () => {
    const css = buildPaletteCss({ scheme: { attribute: 'data-theme' }, defaultScheme: 'light' })
    // The light block absorbs the bare `:root`; dark is attribute-only.
    expect(css).toContain(":root,\n:root[data-theme='light'] {")
    expect(css).toContain(":root[data-theme='dark'] {")
    expect(css).not.toContain(":root,\n:root[data-theme='dark']")
    // …and it wins: light's surface value is what an unattributed document resolves.
    expect(blockOf(css, ":root,\n:root[data-theme='light']")).toContain('--vx-surface-bg')
  })

  it('`defaultScheme: "none"` leaves the bare `:root` carrying only the scalars', () => {
    const css = buildPaletteCss({ scheme: { attribute: 'data-theme' }, defaultScheme: 'none' })
    expect(css).not.toContain(':root,\n')
    expect(css).toContain(":root[data-theme='dark'] {")
    expect(css).toContain(":root[data-theme='light'] {")
    // The theme-independent scalars stay on `:root`; no per-scheme primitive joins them.
    const root = blockOf(css, ':root')
    expect(root).toContain('--vx-radius-card')
    expect(root).not.toContain('--vx-surface-bg')
  })

  it('emits an OS fallback for every non-default scheme, ahead of its attribute block', () => {
    const css = buildPaletteCss({ defaultScheme: 'dark', mediaFallback: true })
    // Dark rides `:root`, so the fallback covers light only.
    expect(css).toContain('@media (prefers-color-scheme: light) {')
    expect(css).not.toContain('@media (prefers-color-scheme: dark) {')
    expect(css.indexOf('@media')).toBeLessThan(
      css.indexOf(":root[data-mantine-color-scheme='light'] {"),
    )
  })

  it('`defaultScheme: "none"` + `mediaFallback` covers both schemes', () => {
    const css = buildPaletteCss({ defaultScheme: 'none', mediaFallback: true })
    expect(css).toContain('@media (prefers-color-scheme: dark) {')
    expect(css).toContain('@media (prefers-color-scheme: light) {')
  })

  it('leaves the legacy selector alone — `only` is orthogonal to the scheme options', () => {
    expect(buildPaletteCss({ only: 'core' })).toContain("html[data-mantine-color-scheme='dark']")
  })

  it('carries consumer `groups` into every emitted scheme block', () => {
    const css = buildPaletteCss({
      scheme: { attribute: 'data-theme' },
      defaultScheme: 'none',
      mediaFallback: true,
      groups: { '': { hrv: { light: '#111111', dark: '#eeeeee' } } },
    })
    expect([...css.matchAll(/--vx-hrv:/g)]).toHaveLength(4) // 2 attribute blocks + 2 media blocks
  })
})

/** Every distinct `--vx-*` name in an emitted stylesheet. */
function varNames(css: string): Set<string> {
  return new Set([...css.matchAll(/--vx-([\w-]+):/g)].map((m) => m[1] as string))
}

/** camelCase key → the `--vx-space-*` suffix `spaceDecls` emits for it. */
const spaceVar = (key: string): string =>
  `space-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`

describe('buildPaletteCss core-only spacing', () => {
  const all = varNames(buildPaletteCss())
  const core = varNames(buildPaletteCss({ only: 'core' }))

  it("`only: 'all'` is the default and changes nothing", () => {
    expect(buildPaletteCss({ only: 'all' })).toBe(buildPaletteCss())
  })

  it('drops 102 of the 116 spacing variables, taking the set from 244 to 142', () => {
    // 211 canonical (all kebab-case, since the 1.4.0 rename) + 32 legacy camelCase aliases
    // (default `legacyAliases: true`) = 243; the alias set is spacing-free, so it rides along
    // unchanged in both `all` and `core`. 211 = 202 at 1.20.0 plus the `nano`/`display` type rungs plus the ten control-tier
    // spacing vars of 1.26.0 (docs/CONTROLS-SPEC.md §5; the four anchors among them are core), MINUS
    // the two 1.27.0 deletions (`--vx-space-app-header-mobile-actions-height` and
    // `--vx-space-sticky-header-clearance-mobile` — the two-row mobile header is gone, law C14),
    // MINUS the 1.28.0 deletion of `--vx-space-sidebar-brand-inset-top`, PLUS the 1.29.0 addition
    // of `--vx-space-touch-target` (C5 consolidation) — a `SPACE_FIXED` value, not a `SPACE`
    // anchor, but emitted unconditionally in BOTH `all` and `core` (see `SPACE_FIXED.
    // spaceTouchTarget`'s doc for why it's the one member of that never-emitted group that IS a
    // var), so it rides along in both counts the same way the alias set does = 244.
    expect(all.size).toBe(244)
    expect(core.size).toBe(142)
    expect([...all].filter((n) => n.startsWith('space-'))).toHaveLength(116)
    expect([...core].filter((n) => n.startsWith('space-'))).toHaveLength(14)
  })

  it('keeps exactly the SPACE anchors plus the touch-target floor — the partition tracks the constants, not a list', () => {
    const kept = [...core].filter((n) => n.startsWith('space-')).toSorted()
    const expected = [...Object.keys(SPACE).map(spaceVar), 'space-touch-target'].toSorted()
    expect(kept).toEqual(expected)
  })

  it('drops every SPACE_STEP one-off, so a new one is excluded the day it is added', () => {
    const stepVars = new Set(Object.keys(SPACE_STEP).map(spaceVar))
    expect([...core].filter((n) => stepVars.has(n))).toEqual([])
  })

  it('touches spacing only — color, radius, type and status are identical', () => {
    const dropped = [...all].filter((n) => !core.has(n))
    expect(dropped.every((n) => n.startsWith('space-'))).toBe(true)
    expect(dropped).toHaveLength(102)
  })
})

/**
 * The 1.4.0 kebab-case rename: 20 stems (12 of them the `fillHover-<family>` family) that used to
 * be emitted camelCase are now canonical kebab, with the camelCase spelling kept as an alias —
 * `legacy name -> canonical kebab name`, exhaustive.
 */
const LEGACY_ALIASES: Record<string, string> = {
  accentFill: 'accent-fill',
  accentFillHover: 'accent-fill-hover',
  accentHover: 'accent-hover',
  axisStroke: 'axis-stroke',
  badRef: 'bad-ref',
  badSolid: 'bad-solid',
  dotStroke: 'dot-stroke',
  goodRef: 'good-ref',
  goodSoft: 'good-soft',
  goodSolid: 'good-solid',
  legendText: 'legend-text',
  onAccent: 'on-accent',
  'surface-panelHover': 'surface-panel-hover',
  tooltipBg: 'tooltip-bg',
  tooltipBorder: 'tooltip-border',
  tooltipMuted: 'tooltip-muted',
  tooltipShadow: 'tooltip-shadow',
  tooltipText: 'tooltip-text',
  warnRef: 'warn-ref',
  warnSolid: 'warn-solid',
  ...Object.fromEntries(
    [
      'gray',
      'red',
      'pink',
      'grape',
      'violet',
      'indigo',
      'cyan',
      'teal',
      'green',
      'lime',
      'yellow',
      'orange',
    ].map((name) => [`fillHover-${name}`, `fill-hover-${name}`]),
  ),
}

describe('legacy camelCase aliases (1.4.0 kebab-case rename)', () => {
  it('is exactly 32 stems, per the naming map', () => {
    expect(Object.keys(LEGACY_ALIASES)).toHaveLength(32)
  })

  it('emits all 32 legacy aliases by default, each a pure var() passthrough to its canonical name', () => {
    const css = buildPaletteCss()
    for (const [legacy, canonical] of Object.entries(LEGACY_ALIASES)) {
      expect(css).toContain(`--vx-${legacy}: var(--vx-${canonical});`)
    }
  })

  it('never emits a camelCase name as a DEFINITION — only as an alias var() passthrough', () => {
    const css = buildPaletteCss()
    for (const [, name, value] of css.matchAll(/--vx-([\w-]+):\s*([^;]+);/g)) {
      if (!name || !/[a-z][A-Z]/.test(name)) continue // kebab (or non-alphabetic) name — canonical
      expect(value?.trim()).toMatch(/^var\(--vx-[\w-]+\)$/)
    }
  })

  it('legacyAliases: false emits none of the 32 aliases — canonical names only', () => {
    const css = buildPaletteCss({ legacyAliases: false })
    for (const legacy of Object.keys(LEGACY_ALIASES)) expect(css).not.toContain(`--vx-${legacy}:`)
    expect(css).not.toContain('Deprecated camelCase aliases')
    for (const [, name] of css.matchAll(/--vx-([\w-]+):/g)) expect(name).not.toMatch(/[a-z][A-Z]/)
  })

  it('legacyAliases: false only removes the 32 alias lines — same canonical set either way', () => {
    const withAliases = varNames(buildPaletteCss())
    const withoutAliases = varNames(buildPaletteCss({ legacyAliases: false }))
    // 211 + the 1.29.0 `--vx-space-touch-target` addition (C5 consolidation) = 212.
    expect(withoutAliases.size).toBe(212)
    expect(withAliases.size).toBe(withoutAliases.size + 32)
    for (const name of withoutAliases) expect(withAliases.has(name)).toBe(true)
  })
})
