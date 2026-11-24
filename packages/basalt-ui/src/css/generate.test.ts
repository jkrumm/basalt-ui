import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { deriveV3, DEFAULT_DERIVE_V3_CONFIG } from '../tokens/derive'
import { tokenNames } from '../tokens/emit'
import { contrastRatio } from '../tokens/hct'
import { ARCHIFY_CATEGORIES, ARCHIFY_VARS, generateCss } from './generate'
import type { CssFileName } from './generate'

const FILES: readonly CssFileName[] = [
  'tokens.css',
  'typography.css',
  'prose.css',
  'fonts.css',
  'tailwind.css',
  'archify.css',
]

describe('generateCss', () => {
  const generated = generateCss()

  test('every committed entry equals what the generator renders', () => {
    for (const name of FILES) {
      expect(readFileSync(join(import.meta.dir, name), 'utf8')).toBe(generated[name])
    }
  })

  test('a border with no color utility is the hairline, in the basalt layer, ahead of every utility', () => {
    const css = generated['tailwind.css']
    const layer = css.slice(css.indexOf('@layer basalt {'))
    expect(layer).toContain('::file-selector-button {\n    border-color: var(--basalt-hairline);')
    expect(css).not.toMatch(/outline-color|--tw-ring-color/)
  })

  test('is deterministic', () => {
    expect(generateCss()).toEqual(generated)
  })

  test('every file opens with the two-line provenance header at the fixed contract major', () => {
    for (const name of FILES) {
      const [first, second] = generated[name].split('\n')
      expect(first).toStartWith('/* @generated basalt-ui')
      expect(second).toStartWith('/* basalt-ui 3.0.0 — `')
    }
  })

  test('every --basalt-* read in the six files is a table name', () => {
    const known = new Set(tokenNames())
    for (const name of FILES) {
      for (const [, ref] of generated[name].matchAll(/var\((--basalt-[a-z0-9-]+)/g)) {
        expect(known.has(ref!), `${name} reads ${ref}`).toBe(true)
      }
    }
  })

  test('prose is zero-specificity and unimportant: every selector is a :where() inside basalt.prose', () => {
    const prose = generated['prose.css']
    expect(prose).not.toContain('!important')
    expect(prose).toContain('@layer basalt.prose {')
    const selectors = prose
      .split('\n')
      .filter((line) => line.endsWith('{') && !line.trimStart().startsWith('@'))
      .map((line) => line.trim())
    expect(selectors.length).toBeGreaterThan(30)
    for (const selector of selectors) {
      expect(selector, selector).toMatch(/^:where\(.*\) \{$/)
    }
  })

  test('typography has the :where(:root) base in basalt.type, no bare heading rule, and the reset', () => {
    const type = generated['typography.css']
    expect(type).toContain('@layer basalt.type {')
    expect(type).toContain(':where(:root) {')
    expect(type).not.toMatch(/^\s*h[1-6]\b/m)
    expect(type).toContain('@media (prefers-reduced-motion: reduce)')
    // The motion tokens' own reduced values live in tokens.css, the one file every profile loads.
    expect(type).not.toContain('--basalt-dur-fast')
    expect(generated['tokens.css']).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\n {2}:root \{\n {4}--basalt-dur-fast: 0ms;/,
    )
    expect(type).toContain('animation-duration: 0.01ms !important')
    expect(type).toContain('transition-duration: 0.01ms !important')
    expect(type).toContain('@media (forced-colors: active)')
    expect(type).toContain('@media print')
  })

  test('word-head lifts a heading word space past a quarter of its size', () => {
    // wiring-3.6 measured the word space at 2.3px of 15px (0.153em, tracking included); the utility
    // adds 0.12em, so 0.273em: past the 0.25em floor.
    expect(generated['tailwind.css']).toContain('@utility word-head {\n  word-spacing: 0.12em;\n}')
  })

  test('fonts declares the Head Digits face over the digit range only', () => {
    const fonts = generated['fonts.css']
    expect(fonts).toContain("font-family: 'Head Digits'")
    expect(fonts).toContain('unicode-range: U+0030-0039')
    expect(fonts).toContain("font-family: 'Hubot Sans Variable'")
    expect(fonts).not.toContain('@import')
    expect(fonts).not.toContain('Fallback')
  })
})

// The variables archify's own `classic` theme block sets (assets/template.html, 2.17 and 3.x): the
// contract the preset must cover. A new archify variable is added here and to ARCHIFY_VARS.
const ARCHIFY_CLASSIC_VARS = [
  '--bg',
  '--grid',
  '--text',
  '--text-muted',
  '--text-dim',
  '--text-faint',
  '--panel',
  '--panel-border',
  '--lane-fill',
  '--lane-stroke',
  '--arrow',
  '--arrow-emphasis',
  '--mask',
  ...['frontend', 'backend', 'database', 'cloud', 'security', 'messagebus', 'external'].flatMap(
    (c) => [`--${c}-fill`, `--${c}-stroke`],
  ),
  '--toolbar-bg',
  '--toolbar-border',
  '--toolbar-text',
  '--toolbar-hover',
  '--toolbar-menu-bg',
]

describe('archify.css', () => {
  const css = generateCss()['archify.css']

  test('one unlayered theme-agnostic block that sets every archify classic variable', () => {
    expect(css).not.toContain('@layer')
    expect(css).not.toContain('data-theme')
    expect(css.match(/^\S.*\{$/gm)).toEqual(["[data-preset='basalt'] {"])
    const set = [...css.matchAll(/^ {2}(--[a-z-]+):/gm)].map((m) => m[1])
    expect(set.toSorted()).toEqual(ARCHIFY_CLASSIC_VARS.toSorted())
  })

  test('carries no color literal: every value is a token read', () => {
    for (const value of Object.values(ARCHIFY_VARS)) {
      expect(value).toMatch(/var\(--basalt-[a-z0-9-]+\)/)
      expect(value).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsl|oklch\(/i)
    }
  })

  test('strokes hold 3:1 and text 4.5:1 against the canvas, in both schemes', () => {
    const derived = deriveV3(DEFAULT_DERIVE_V3_CONFIG)
    const token = (value: string): string => /var\(--basalt-([a-z0-9-]+)\)/.exec(value)![1]!
    for (const scheme of ['light', 'dark'] as const) {
      const canvas = derived.colors.canvas[scheme]
      const read = (name: string) =>
        derived.colors[token(name) as keyof typeof derived.colors][scheme]
      for (const [category] of ARCHIFY_CATEGORIES) {
        const stroke = ARCHIFY_VARS[`--${category}-stroke`]!
        expect(contrastRatio(read(stroke), canvas), `${category} ${scheme}`).toBeGreaterThanOrEqual(
          3,
        )
      }
      for (const name of ['--arrow', '--arrow-emphasis']) {
        expect(
          contrastRatio(read(ARCHIFY_VARS[name]!), canvas),
          `${name} ${scheme}`,
        ).toBeGreaterThanOrEqual(3)
      }
      for (const name of ['--text', '--text-muted', '--text-faint']) {
        expect(
          contrastRatio(read(ARCHIFY_VARS[name]!), canvas),
          `${name} ${scheme}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })
})
