/**
 * CSS-text regression tests for two shell rules that broke silently because neither is exercised
 * by a render test: `.footerVersion`'s collapsed-rail hide (a corrupted selector left it unscoped,
 * hiding the sidebar version label at every desktop viewport) and the sticky page-bar rows' z-index
 * (a bare `1` let ordinary in-flow content — Mantine's Input section, Indicator, sticky table
 * headers — paint over them while scrolling).
 *
 * Both are asserted against the raw `.module.css` source text rather than through jsdom: jsdom does
 * not implement CSS cascade/specificity resolution or `getComputedStyle` for stacking, so a
 * render-based test cannot see either regression. Reading the source text directly is what actually
 * pins the rule shape.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

const APP_SIDEBAR_CSS = readFileSync(
  join(import.meta.dir, '../shell/app-sidebar.module.css'),
  'utf8',
)
const PAGE_BAR_CSS = readFileSync(join(import.meta.dir, '../shell/page-bar.module.css'), 'utf8')

/** The `@media (min-width: 48em)` rail block — where `[data-collapsed]` rules live. */
function railBlock(css: string): string {
  const start = css.indexOf('@media (min-width: 48em)')
  expect(start).toBeGreaterThanOrEqual(0)
  return css.slice(start)
}

describe('app-sidebar.module.css — collapsed-rail `.footerVersion` hide', () => {
  const rail = railBlock(APP_SIDEBAR_CSS)

  it('scopes the version-label hide to `.root[data-collapsed]`, not a bare `.footerVersion`', () => {
    expect(rail).toContain('.root[data-collapsed] .footerVersion {\n    display: none;\n  }')
  })

  it('never declares an unscoped `.footerVersion` rule inside the rail media query', () => {
    // A bare `.footerVersion {` (no `[data-collapsed]` ancestor on the same rule) would hide the
    // version label at every desktop viewport, expanded or collapsed — the exact regression.
    for (const m of rail.matchAll(/([^{}\n]+)\{\s*display:\s*none;\s*\}/g)) {
      const selector = m[1]!.trim()
      if (!selector.endsWith('.footerVersion')) continue
      expect(selector).toContain('[data-collapsed]')
    }
  })

  it('does not duplicate the base `.footerIconSlot` rule inside the rail media query', () => {
    // The real `.footerIconSlot` rule is declared once, outside the media query — a stray copy
    // inside `@media (min-width: 48em)` is the corruption artifact this test guards against.
    expect([...rail.matchAll(/\.footerIconSlot\s*\{/g)]).toHaveLength(0)
  })
})

describe('page-bar.module.css — sticky rows sit under the AppShell header, above page content', () => {
  it('`.bar` sits one layer below the AppShell header, not at the bare `z-index: 1` every sibling can equal', () => {
    const bar = PAGE_BAR_CSS.slice(
      PAGE_BAR_CSS.indexOf('.bar {'),
      PAGE_BAR_CSS.indexOf('\n}', PAGE_BAR_CSS.indexOf('.bar {')),
    )
    expect(bar).toContain('z-index: calc(var(--app-shell-header-z-index, 100) - 1);')
    expect(bar).not.toMatch(/z-index:\s*1\s*;/)
  })

  it('`.row2Sticky` uses the same header-relative z-index as `.bar`, so the two never fall out of sync', () => {
    const row2 = PAGE_BAR_CSS.slice(
      PAGE_BAR_CSS.indexOf('.row2Sticky {'),
      PAGE_BAR_CSS.indexOf('\n}', PAGE_BAR_CSS.indexOf('.row2Sticky {')),
    )
    expect(row2).toContain('z-index: calc(var(--app-shell-header-z-index, 100) - 1);')
    expect(row2).not.toMatch(/z-index:\s*1\s*;/)
  })
})
