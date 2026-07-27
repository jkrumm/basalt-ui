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
