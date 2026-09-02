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

describe('page-bar.module.css — the SHELL-LESS bar sticks; the in-shell row does not', () => {
  it('`.bar` sits one layer below the AppShell header, not at the bare `z-index: 1` every sibling can equal', () => {
    const bar = PAGE_BAR_CSS.slice(
      PAGE_BAR_CSS.indexOf('.bar {'),
      PAGE_BAR_CSS.indexOf('\n}', PAGE_BAR_CSS.indexOf('.bar {')),
    )
    expect(bar).toContain('z-index: calc(var(--app-shell-header-z-index, 100) - 1);')
    expect(bar).not.toMatch(/z-index:\s*1\s*;/)
  })

  it('`.row2Band` is positionless — inside a shell the BAND owns the geometry, not the row', () => {
    // Row 2 portals into `BasaltShell`'s band (`app-main.module.css`'s `.band`), a sibling of the
    // scrollport. Nothing here may position it: a `position: sticky` would reintroduce the exact
    // defect the portal removed — a sticky offset clamped to whatever wrapper the consumer happened
    // to write `<PageBar>` inside, so the same markup landed at two different y values.
    const row2 = PAGE_BAR_CSS.slice(
      PAGE_BAR_CSS.indexOf('.row2Band {'),
      PAGE_BAR_CSS.indexOf('\n}', PAGE_BAR_CSS.indexOf('.row2Band {')),
    )
    expect(row2).not.toContain('position:')
    expect(row2).not.toContain('z-index:')
    expect(row2).not.toContain('border-bottom')
  })
})

/**
 * Walks brace depth from a `@media (...)` match to its matching close, rather than slicing to EOF —
 * a naive `decls.slice(mediaStart)` treats every byte after the media query's OPENING brace as
 * "mobile" forever, including desktop-scope rules declared below the block (this file's own
 * `.panelPill` sits after the media query), and a rule-body regex anchored to the first declaration
 * (`\{\s*\n\s*flex-direction:`) fails on behaviour-neutral reordering. Both are avoided here: the
 * block is bounded by its real closing brace, and rule bodies are matched as `[^}]*` so declaration
 * order is free.
 */
function extractMediaBlock(css: string, mediaStart: number): { body: string; end: number } {
  const braceStart = css.indexOf('{', mediaStart)
  let depth = 0
  for (let i = braceStart; i < css.length; i++) {
    if (css[i] === '{') depth++
    else if (css[i] === '}') {
      depth--
      if (depth === 0) return { body: css.slice(braceStart + 1, i), end: i + 1 }
    }
  }
  throw new Error('unterminated @media block')
}

describe('page-bar.module.css — row 2 folds into two declared lines below sm, never a wrap', () => {
  /** Declarations only — the block comments above them discuss `overflow-x` and C7 by name. */
  const decls = PAGE_BAR_CSS.replace(/\/\*[\s\S]*?\*\//g, '')
  const mediaStart = decls.indexOf('@media (max-width: 47.99375em)')
  const { body: mobileBlock, end: mediaEnd } = extractMediaBlock(decls, mediaStart)
  const desktopCss = decls.slice(0, mediaStart) + decls.slice(mediaEnd)

  it('the mobile media block declares `.row2 { flex-direction: column }`', () => {
    expect(mediaStart).toBeGreaterThanOrEqual(0)
    const rule = mobileBlock.match(/\.row2\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule?.[1]).toMatch(/flex-direction:\s*column/)
  })

  it('never scrolls sideways and never wraps — law C7 in CSS form', () => {
    expect(decls).not.toContain('flex-wrap: wrap')
    expect(decls).not.toContain('overflow-x')
  })

  it('`.pills` declares `flex-wrap: nowrap`', () => {
    const rule = decls.slice(
      decls.indexOf('.pills {'),
      decls.indexOf('\n}', decls.indexOf('.pills {')),
    )
    expect(rule).toContain('flex-wrap: nowrap')
  })

  it('desktop stays one line — no `.row2 { … flex-direction: column }` anywhere outside the mobile media block', () => {
    const rule = desktopCss.match(/\.row2\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule?.[1]).not.toMatch(/flex-direction:\s*column/)
  })

  it('the mobile tabs selectors reach past the `CtlSlot` wrapper — `display: contents` means `.tabs > *` matches only the inert wrapper, never `ViewTabs`', () => {
    expect(mobileBlock).not.toMatch(/\.tabs\s*>\s*\*\s*\{/)
    expect(mobileBlock).toMatch(/\.tabs\s*>\s*\[data-basalt-tier\]\s*>\s*\*\s*\{/)
    expect(mobileBlock).toMatch(
      /\.tabs\s*>\s*\[data-basalt-tier\]\s*>\s*:global\(\.mantine-Select-root\)\s*\{/,
    )
  })

  it('an empty `.pills` line reserves nothing below `sm` (law C14) — `filtersEnd` alone renders only in the row-1 kebab there', () => {
    const rule = mobileBlock.match(/\.pills:not\(:has\(([^)]*)\)\)\s*\{([^}]*)\}/)
    expect(rule).not.toBeNull()
    expect(rule?.[1]).toContain('> .filters')
    expect(rule?.[1]).toContain('> .panelPill')
    expect(rule?.[2]).toMatch(/display:\s*none/)
  })
})
