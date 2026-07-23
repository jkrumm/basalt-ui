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

describe('prose.module.css — responsive sticky-header clearance split (Decision 3)', () => {
  const css = readFileSync(PROSE_CSS_PATH, 'utf8')

  // The first (unconditional) `.root h2, .root h3, .root h4 { scroll-margin-top: … }` rule in the
  // file — `.match` without the `g` flag returns the first match, which is this one since it
  // precedes the `@media` override in source.
  const baseRuleMatch = css.match(
    /\.root h2,\s*\.root h3,\s*\.root h4\s*\{\s*scroll-margin-top:\s*([^;]+);\s*\}/,
  )

  it('the base (non-media) rule clears the DESKTOP header', () => {
    expect(baseRuleMatch).not.toBeNull()
    expect(baseRuleMatch?.[1]).toBe('var(--vx-space-sticky-header-clearance)')
  })

  // Requires the literal `max-width: 47.99375em` query wrapping the rule — fails if the query is
  // inverted to `min-width`, retuned to a different value, or the whole `@media` block is deleted.
  const mediaBlockMatch = css.match(
    /@media\s*\(max-width:\s*47\.99375em\)\s*\{[\s\S]*?\.root h2,\s*\.root h3,\s*\.root h4\s*\{\s*scroll-margin-top:\s*([^;]+);\s*\}\s*\}/,
  )

  it("the mobile override exists at Mantine's exact 48em min-width complement (47.99375em)", () => {
    expect(mediaBlockMatch).not.toBeNull()
  })

  it('the media override clears the MOBILE header, not the desktop one (catches a var swap)', () => {
    expect(mediaBlockMatch?.[1]).toBe('var(--vx-space-sticky-header-clearance-mobile)')
  })

  it('the base rule appears before the override in source order — both share (0,2,1) specificity, so a same-specificity tie resolves by source order regardless of the @media nesting; an override placed BEFORE the base rule would lose to it even while the media query matches', () => {
    const baseIndex = css.indexOf('scroll-margin-top: var(--vx-space-sticky-header-clearance);')
    const mobileIndex = css.indexOf(
      'scroll-margin-top: var(--vx-space-sticky-header-clearance-mobile);',
    )
    expect(baseIndex).toBeGreaterThan(-1)
    expect(mobileIndex).toBeGreaterThan(baseIndex)
  })
})
