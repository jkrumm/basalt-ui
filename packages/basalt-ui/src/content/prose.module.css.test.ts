/**
 * Regression test for the anchor clearance in `prose.module.css` — the CSS side of
 * `--vx-space-sticky-header-clearance` has no other coverage: `theme/spacing.test.ts` /
 * `density-relations.test.ts` lock the NUMBER, but nothing asserted what the rule adds to it.
 *
 * It began as the guard on the responsive desktop/mobile split (Decision 3), then on the
 * `+ var(--basalt-page-bar-h)` term. Both terms are now GONE and their absence is what this file
 * pins: an anchor scroll happens inside `AppShell.Main`, and both the AppShell header and `PageBar`
 * row 2's band are shell regions rendered outside that scrollport
 * (`shell/app-main.module.css`) — adding either back would push every heading that far down the
 * page, silently, on every consumer. Asserted directly against the shipped CSS text, same pattern
 * as `styles.floor.test.ts`.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'bun:test'

const PROSE_CSS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'prose.module.css')

describe('prose.module.css — anchor clearance (breathing room, and no chrome height)', () => {
  const css = readFileSync(PROSE_CSS_PATH, 'utf8')

  // The first (unconditional) `.root h2, .root h3, .root h4 { scroll-margin-top: … }` rule in the
  // file — `.match` without the `g` flag returns the first match, which is this one since it
  // precedes the `@media` override in source.
  const baseRuleMatch = css.match(
    /\.root h2,\s*\.root h3,\s*\.root h4\s*\{\s*scroll-margin-top:\s*([^;]+);\s*\}/,
  )

  it('is the clearance token alone — no header height, no PageBar band', () => {
    expect(baseRuleMatch).not.toBeNull()
    expect(baseRuleMatch?.[1]).toBe('var(--vx-space-sticky-header-clearance)')
    // …and no OTHER rule reintroduces either term. Comments are stripped first: the rule above this
    // one names both vars to say why they are absent, and a naive text scan would read that
    // explanation as the regression it exists to prevent.
    const code = css.replaceAll(/\/\*[\s\S]*?\*\//g, '')
    expect(code).not.toContain('--app-shell-header-height')
    expect(code).not.toContain('--basalt-page-bar-h')
  })

  it('has no mobile override — the -mobile clearance token no longer exists', () => {
    expect(css).not.toContain('clearance-mobile')
    expect(css).not.toContain('@media (max-width: 47.99375em)')
  })
})
