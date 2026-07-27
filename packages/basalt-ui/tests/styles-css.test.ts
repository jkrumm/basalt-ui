/**
 * `styles.css` reach guards — the rules that fire on a consumer's own markup.
 *
 * Everything in this stylesheet lands in every consumer app, and two of its rules used to match
 * elements basalt does not own. The print rule matched bare `nav`/`header`/`footer`, so a page with
 * a real landmark and no `BasaltShell` printed it blank; being unlayered and `!important` it could
 * not be overridden either. The heading rule matches bare `h1`–`h6` by design, but hardcoded its
 * width, so a consumer layering its own base type had no knob to reach for.
 *
 * Both are text assertions rather than rendered ones on purpose: this is a shipped ASSET, not a
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

/** The `@media print { … }` block and its selector list. */
const printBlock = /@media print \{([\s\S]*?)\n {2}\}/.exec(css)?.[1] ?? ''

describe('styles.css print rule', () => {
  it('exists', () => {
    expect(printBlock).not.toBe('')
  })

  it('hides the shell chrome by class hook, never by bare landmark element', () => {
    expect(printBlock).toContain('.mantine-AppShell-navbar')
    expect(printBlock).toContain('.mantine-AppShell-header')
    expect(printBlock).toContain('.mantine-AppShell-footer')
    // A consumer's own <nav>/<header>/<footer> must survive printing.
    expect(/^\s*(nav|header|footer),?\s*$/m.test(printBlock)).toBe(false)
  })

  it('sits inside @layer basalt, so a consumer can override it', () => {
    const layerStart = css.indexOf('@layer basalt {')
    expect(layerStart).toBeGreaterThanOrEqual(0)
    expect(css.indexOf('@media print')).toBeGreaterThan(layerStart)
  })

  it('carries no !important — layer order already wins', () => {
    expect(printBlock).not.toContain('!important')
  })
})

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
    expect(declarations).toContain('font-size: max(16px, var(--input-fz, 1rem)) !important')
  })
})
