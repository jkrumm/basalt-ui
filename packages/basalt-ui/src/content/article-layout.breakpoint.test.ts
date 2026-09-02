/**
 * The article breakpoint is stated twice — once as a number CSS can read, once as a token JS can.
 * It has to be: a `@media` condition is evaluated before custom properties exist, so
 * `@media (max-width: var(--vx-bp-article))` is not valid CSS and never will be. The literal is
 * therefore unavoidable; what IS avoidable is the two halves drifting, which is what this asserts.
 *
 * Same idiom as `styles.floor.test.ts`: read the shipped stylesheet text and hold it to the
 * declared value, rather than trusting a comment to keep them in step.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'bun:test'
import { BREAKPOINTS } from '../tokens'

const CSS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'article-layout.module.css')

describe('article-layout.module.css — the TOC-rail breakpoint', () => {
  const css = readFileSync(CSS_PATH, 'utf8')

  it('declares exactly one max-width media query', () => {
    const queries = css.match(/@media\s*\(max-width:\s*\d+px\)/g) ?? []
    expect(queries).toHaveLength(1)
  })

  it('writes the same number BREAKPOINTS.article declares', () => {
    const match = css.match(/@media\s*\(max-width:\s*(\d+)px\)/)
    expect(match).not.toBeNull()
    expect(Number(match?.[1])).toBe(BREAKPOINTS.article)
  })

  it('names the token beside the literal, so the next reader finds the other half', () => {
    expect(css).toContain('BREAKPOINTS.article')
  })
})
