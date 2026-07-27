/**
 * The default `buildPaletteCss()` output, pinned byte-for-byte against a committed fixture.
 *
 * `--vx-*` CSS is the framework's widest contract: the Mantine theme, every CSS module, every
 * chart, and (since the framework-free work) a non-React consumer that ships the emitted string
 * directly all read the same variable set. A refactor of the emitter that shifts one declaration,
 * one selector, or one byte of whitespace is a silent behavior change for all of them — the unit
 * tests around individual token groups can't see it, because each only asserts its own slice.
 *
 * So the gate is the whole string, not a property of it. `tests/fixtures/palette-default.css` is
 * regenerated deliberately (see below) and reviewed as a diff; an accidental change fails here
 * instead of shipping. This is what makes the optional emission modes safe to add — every one of
 * them must leave the no-argument output identical, and this test is the only thing that proves it.
 *
 * The fixture lives under `tests/` rather than `src/` on purpose: `scripts/copy-assets.mjs` mirrors
 * every `src/**\/*.css` into `dist/`, so a fixture in the source tree would be published as if it
 * were a real stylesheet.
 *
 * Regenerate after an INTENDED change:
 *   cd packages/basalt-ui && bun tests/fixtures/regen.ts
 *
 * Run: bun test packages/basalt-ui/tests/palette-css.test.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'
import { buildPaletteCss } from '../src/tokens'
import { SPACE, SPACE_STEP } from '../src/tokens/palette'

const FIXTURE = join(import.meta.dir, 'fixtures', 'palette-default.css')

describe('buildPaletteCss default output', () => {
  const fixture = readFileSync(FIXTURE, 'utf8')

  it('is byte-identical to the committed fixture', () => {
    expect(buildPaletteCss()).toBe(fixture)
  })

  it('keeps the legacy `html[data-mantine-color-scheme]` selectors on the default path', () => {
    // The default output tracks Mantine's own toggle attribute on <html>, at 0-1-1 specificity.
    // Consumers override basalt vars under that same selector; raising it (to `:root[…]`, 0-2-0)
    // would silently win over their override. The custom-selector path emits `:root[…]` instead —
    // see `BuildPaletteOpts.scheme`.
    expect(fixture).toContain("html[data-mantine-color-scheme='dark']")
    expect(fixture).toContain("html[data-mantine-color-scheme='light']")
    expect(fixture).not.toContain(':root[')
  })

  it('stays on the legacy shape for the options that do not touch the selector', () => {
    expect(buildPaletteCss({ groups: {}, derived: [] })).toBe(fixture)
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

  it('drops 95 of the 104 spacing variables, taking the set from 197 to 102', () => {
    expect(all.size).toBe(197)
    expect(core.size).toBe(102)
    expect([...all].filter((n) => n.startsWith('space-'))).toHaveLength(104)
    expect([...core].filter((n) => n.startsWith('space-'))).toHaveLength(9)
  })

  it('keeps exactly the SPACE anchors — the partition tracks the constants, not a list', () => {
    const kept = [...core].filter((n) => n.startsWith('space-')).toSorted()
    expect(kept).toEqual(Object.keys(SPACE).map(spaceVar).toSorted())
  })

  it('drops every SPACE_STEP one-off, so a new one is excluded the day it is added', () => {
    const stepVars = new Set(Object.keys(SPACE_STEP).map(spaceVar))
    expect([...core].filter((n) => stepVars.has(n))).toEqual([])
  })

  it('touches spacing only — color, radius, type and status are identical', () => {
    const dropped = [...all].filter((n) => !core.has(n))
    expect(dropped.every((n) => n.startsWith('space-'))).toBe(true)
    expect(dropped).toHaveLength(95)
  })
})
