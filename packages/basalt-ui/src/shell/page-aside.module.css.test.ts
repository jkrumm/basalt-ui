/**
 * Regression test for the aside's shell-form header height (`docs/ASIDE-SPEC.md`,
 * `docs/DESIGN-SPEC.md` §5) — same "assert directly against the shipped CSS text" idiom as
 * `content/prose.module.css.test.ts`.
 *
 * The rule is not `min-height: var(--basalt-page-bar-h, …)` alone. `--basalt-page-bar-h` measures
 * only `PageBar` row 2's own content box (`shell/page-bar.tsx`'s `measureRef`); the shell's page-bar
 * band draws its `border-bottom` OUTSIDE that box, on an unconstrained `height: auto` element
 * (`app-main.module.css`'s `.band`), while this header is an explicit `min-height` under the page's
 * global `box-sizing: border-box` reset, which ABSORBS its own border INSIDE whatever height is
 * declared. Feeding the raw var straight through undershoots the band's painted bottom edge by
 * exactly that border (MEASURED on `/cbbi` 1440x900: band bottom y87, header bottom y86 with the
 * raw var, y96 with the pre-fix fixed 48px). The `+ 1px` wrapping BOTH branches of the var/fallback
 * is what closes it without moving the no-band fallback off its ordinary 48px.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'bun:test'

const CSS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'page-aside.module.css')

describe('page-aside.module.css — the shell header height tracks the page-bar band', () => {
  const css = readFileSync(CSS_PATH, 'utf8').replaceAll(/\/\*[\s\S]*?\*\//g, '')

  const ruleMatch = css.match(/\.panel\[data-basalt-page-aside='shell'\] \.header\s*\{([^}]+)\}/)

  it('declares a header rule at all', () => {
    expect(ruleMatch).not.toBeNull()
  })

  const rule = ruleMatch?.[1] ?? ''

  it('min-height reads --basalt-page-bar-h first, +1px, over the unchanged 48px fallback', () => {
    const minHeight = rule
      .match(/min-height:\s*([^;]+);/)?.[1]
      ?.replace(/\s+/g, ' ')
      .trim()
    expect(minHeight).toBe(
      'calc( var( --basalt-page-bar-h, calc(var(--app-shell-header-height, ' +
        'var(--vx-space-section-header-height, 2.25rem)) - 1px) ) + 1px )',
    )
  })

  it('still carries the header seam that closes the top belt across the aside', () => {
    expect(rule).toContain('border-bottom: 1px solid var(--vx-divider)')
  })
})
