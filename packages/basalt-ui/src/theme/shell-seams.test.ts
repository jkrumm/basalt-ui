/**
 * Region seams (docs/DESIGN-SPEC.md §5, §8 #12) — a mechanical inventory over what
 * `src/shell/*.module.css` still draws, now that the four `AppShell` region edges are Mantine's
 * own `[data-with-border]` lines, coloured through the theme's `AppShell.extend({ vars })`
 * (`theme/index.ts`) rather than by any shell module.
 *
 * CSS-text idiom (`layout-rhythm-css.test.ts`'s), a NEW file rather than an addition there: that
 * file's "row 2" describe block belongs to a different slice landing this round.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

const SHELL_DIR = join(import.meta.dir, '../shell')

type BorderDecl = { readonly file: string; readonly selector: string; readonly decl: string }

/** A `border`/`border-<side>` declaration — widened from `divider-law.test.ts`'s to also catch
 * `left`/`right`/`inline`/`block`/`inline-start`/`inline-end`/`block-start`/`block-end`, and the
 * bare shorthand itself (so the shorthand's absence can be asserted, not just assumed). The
 * two-side logical shorthands (`border-inline:`, `border-block:`) are listed alongside their
 * `-start`/`-end` halves so a declaration written either way is caught. `border-radius`/
 * `border-*-radius` never match: no alternative below is a valid continuation of `-radius`, so the
 * whole pattern fails there. */
const BORDER_DECL =
  /^border(-top|-bottom|-left|-right|-inline|-block|-inline-start|-inline-end|-block-start|-block-end)?:\s*(.+)$/

/** Every border-family declaration in a flat `src/shell/*.module.css` file, with the selector it
 * sits under. Skips `border: none` / `border: 0` — a reset, not an edge. */
function scanShellBorders(): BorderDecl[] {
  const found: BorderDecl[] = []
  const files = readdirSync(SHELL_DIR)
    .filter((f) => f.endsWith('.module.css'))
    .toSorted()
  for (const file of files) {
    const css = readFileSync(join(SHELL_DIR, file), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
    const stack: string[] = []
    let buf = ''
    for (const ch of css) {
      if (ch === '{') {
        stack.push(buf.trim().replace(/\s+/g, ' '))
        buf = ''
        continue
      }
      if (ch === '}') {
        stack.pop()
        buf = ''
        continue
      }
      if (ch !== ';') {
        buf += ch
        continue
      }
      const decl = buf.trim().replace(/\s+/g, ' ')
      buf = ''
      const m = BORDER_DECL.exec(decl)
      if (m === null) continue
      const side = m[1]
      const value = m[2]!.trim()
      if (side === undefined && (value === 'none' || value === '0')) continue
      found.push({ file, selector: stack.join(' >> '), decl })
    }
  }
  return found
}

const found = scanShellBorders()

describe('shell chrome — the only border-family declarations left', () => {
  test('the inventory equals exactly the sidebar child-guide, the aside between-groups rule and the aside header seam', () => {
    // A new chrome edge must be classified HERE — as the sidebar's child-list guide, the aside's
    // between-groups rule or the aside header's seam-continuation rule are, or as a region seam
    // this file does not scan at all.
    const summary = found.map((f) => `${f.file} → ${f.selector}`).toSorted()
    expect(summary).toEqual(
      [
        'app-sidebar.module.css → .childList',
        'page-aside.module.css → .body > * + *',
        "page-aside.module.css → .panel[data-basalt-page-aside='shell'] .header",
      ].toSorted(),
    )
  })

  test('every declaration is DIRECTIONAL — never the bare `border:` shorthand', () => {
    for (const f of found) expect(f.decl.startsWith('border-')).toBe(true)
  })

  test('every declaration references --vx-divider', () => {
    for (const f of found) expect(f.decl).toContain('var(--vx-divider)')
  })
})

/** The `{ selector }` rule body, bounded by its own closing brace — same idiom as
 * `layout-rhythm-css.test.ts`'s `.bar`/`.row2Sticky` slices. */
function ruleBody(css: string, selector: string): string {
  const start = css.indexOf(selector)
  expect(start).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf('\n}', start))
}

describe("no region edge in a region module — that seam is Mantine's AppShell.extend now", () => {
  test('page-aside shell panel has no leading-edge border', () => {
    const css = readFileSync(join(SHELL_DIR, 'page-aside.module.css'), 'utf8')
    const rule = ruleBody(css, ".panel[data-basalt-page-aside='shell'] {")
    expect(rule).not.toMatch(/border-left|border-inline-start/)
  })

  test('app-sidebar .root has no trailing-edge border', () => {
    const css = readFileSync(join(SHELL_DIR, 'app-sidebar.module.css'), 'utf8')
    const rule = ruleBody(css, '.root {')
    expect(rule).not.toMatch(/border-right|border-inline-end/)
  })

  test('app-header .bar has no bottom border', () => {
    const css = readFileSync(join(SHELL_DIR, 'app-header.module.css'), 'utf8')
    const rule = ruleBody(css, '.bar {')
    expect(rule).not.toContain('border-bottom')
  })

  test('app-mobile-nav .bar has no top border', () => {
    const css = readFileSync(join(SHELL_DIR, 'app-mobile-nav.module.css'), 'utf8')
    const rule = ruleBody(css, '.bar {')
    expect(rule).not.toContain('border-top')
  })
})

describe('the shared top bands — brand row and aside header at one appShellHeaderHeight', () => {
  test('app-sidebar .brand reads the header-height var, not a fixed px inset', () => {
    const css = readFileSync(join(SHELL_DIR, 'app-sidebar.module.css'), 'utf8')
    const rule = ruleBody(css, '.brand {')
    expect(rule).toContain('var(--app-shell-header-height')
    expect(rule).not.toMatch(/min-height:\s*\d/)
    expect(rule).not.toMatch(/padding-top:\s*\d/)
  })

  test("page-aside's shell header reads the header-height var, not a fixed px inset", () => {
    const css = readFileSync(join(SHELL_DIR, 'page-aside.module.css'), 'utf8')
    const rule = ruleBody(css, ".panel[data-basalt-page-aside='shell'] .header {")
    expect(rule).toContain('var(--app-shell-header-height')
    expect(rule).not.toMatch(/min-height:\s*\d/)
    expect(rule).not.toMatch(/padding-top:\s*\d/)
  })
})

describe("page-aside's shell body — symmetric air under the header band", () => {
  test('declares padding-block and no padding-bottom', () => {
    const css = readFileSync(join(SHELL_DIR, 'page-aside.module.css'), 'utf8')
    const rule = ruleBody(css, ".panel[data-basalt-page-aside='shell'] .body {")
    expect(rule).toContain('padding-block:')
    expect(rule).not.toContain('padding-bottom:')
  })
})
