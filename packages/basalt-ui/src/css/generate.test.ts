import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tokenNames } from '../tokens/emit'
import { generateCss } from './generate'
import type { CssFileName } from './generate'

const FILES: readonly CssFileName[] = [
  'tokens.css',
  'typography.css',
  'prose.css',
  'fonts.css',
  'tailwind.css',
]

describe('generateCss', () => {
  const generated = generateCss()

  test('every committed entry equals what the generator renders', () => {
    for (const name of FILES) {
      expect(readFileSync(join(import.meta.dir, name), 'utf8')).toBe(generated[name])
    }
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

  test('every --vx-* read in the five files is a table name', () => {
    const known = new Set(tokenNames())
    for (const name of FILES) {
      for (const [, ref] of generated[name].matchAll(/var\((--vx-[a-z0-9-]+)/g)) {
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
    expect(type).toContain('--vx-dur-fast: 0ms !important')
    expect(type).toContain('animation-duration: 0.01ms !important')
    expect(type).toContain('transition-duration: 0.01ms !important')
    expect(type).toContain('@media (forced-colors: active)')
    expect(type).toContain('@media print')
  })

  test('fonts declares the Head Digits face over the digit range only', () => {
    const fonts = generated['fonts.css']
    expect(fonts).toContain("font-family: 'Head Digits'")
    expect(fonts).toContain('unicode-range: U+0030-0039')
    expect(fonts).toContain("@import '@fontsource-variable/hubot-sans/wdth.css'")
    expect(fonts).toContain('size-adjust')
  })
})
