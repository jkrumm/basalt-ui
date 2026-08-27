/**
 * Regression test for the responsive sticky-header-clearance split (Decision 3,
 * `deriveSpacing`'s JSDoc in `tokens/palette.ts`, third bullet) — the CSS side of it has no other
 * coverage: `theme/spacing.test.ts`/`density-relations.test.ts` lock the two `--vx-space-sticky-
 * header-clearance*` NUMBERS, but nothing asserted that `prose.module.css` actually wires the
 * DESKTOP var to the unconditional rule and the MOBILE var to the `max-width` override — an
 * inverted media query, a swap of the two vars, or a deleted `@media` block would all pass the rest
 * of the suite silently. Asserted directly against the shipped CSS text, same pattern as
 * `styles.floor.test.ts`.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'bun:test'

const PROSE_CSS_PATH = resolve(dirname(fileURLToPath(import.meta.url)), 'prose.module.css')

describe('prose.module.css — sticky-header clearance (one header height, plus the PageBar row)', () => {
  const css = readFileSync(PROSE_CSS_PATH, 'utf8')

  // The first (unconditional) `.root h2, .root h3, .root h4 { scroll-margin-top: … }` rule in the
  // file — `.match` without the `g` flag returns the first match, which is this one since it
  // precedes the `@media` override in source.
  const baseRuleMatch = css.match(
    /\.root h2,\s*\.root h3,\s*\.root h4\s*\{\s*scroll-margin-top:\s*([^;]+);\s*\}/,
  )

  it('clears the header plus the sticky PageBar row on every viewport (one header height since C14)', () => {
    expect(baseRuleMatch).not.toBeNull()
    expect(baseRuleMatch?.[1]).toBe(
      'calc(var(--vx-space-sticky-header-clearance) + var(--basalt-page-bar-h, 0px))',
    )
  })

  it('has no mobile override — the -mobile clearance token no longer exists', () => {
    expect(css).not.toContain('clearance-mobile')
    expect(css).not.toContain('@media (max-width: 47.99375em)')
  })
})
