/**
 * `styles.css` reach guards — the rules that fire on a consumer's own markup.
 *
 * Everything in this stylesheet lands in every consumer app. The heading rule matches bare `h1`–`h6`
 * by design, but must read a width knob so a consumer layering its own base type has one to reach
 * for. The stylesheet declares its own layer before its imports so basalt's cascade position holds
 * whatever order a bundler emits the files in.
 *
 * These are text assertions rather than rendered ones on purpose: this is a shipped ASSET, not a
 * module — no bundler, no jsdom, and the two properties that matter (which layer a rule sits in,
 * and which selectors it carries) are visible in the source and invisible to a render test.
 *
 * Run: bun test packages/basalt-ui/tests/styles-css.test.ts
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

const css = readFileSync(join(import.meta.dir, '..', 'src', 'styles.css'), 'utf8')
/** Declarations only — the comments discuss `!important` at length and would skew the count. */
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, '')

describe('styles.css heading width', () => {
  it('reads a knob instead of hardcoding the condensed width', () => {
    expect(css).toContain('font-stretch: var(--basalt-font-head-stretch, 88%)')
    expect(css).toContain('--basalt-font-head-stretch: 88%')
  })
})

describe('styles.css !important budget', () => {
  it('uses !important exactly once — the iOS input-zoom floor', () => {
    const uses = [...declarations.matchAll(/!important/g)]
    expect(uses).toHaveLength(1)
    expect(declarations).toContain(
      'font-size: max(var(--basalt-input-fz-floor, 16px), var(--input-fz, 1rem)) !important',
    )
  })
})

describe('styles.css layer and imports', () => {
  const layerAt = declarations.indexOf('@layer basalt;')

  it('declares its layer before any import', () => {
    expect(layerAt).toBeGreaterThanOrEqual(0)
    expect(declarations.indexOf('@import')).toBeGreaterThan(layerAt)
  })

  it('imports no UI framework', () => {
    expect(declarations).not.toContain('@mantine/')
  })

  it('places every @import before any rule', () => {
    const firstRule = declarations.search(/@layer\s+\w+\s*\{|[^@\s;{}][^;{}]*\{/)
    expect(firstRule).toBeGreaterThan(declarations.lastIndexOf('@import'))
  })
})
