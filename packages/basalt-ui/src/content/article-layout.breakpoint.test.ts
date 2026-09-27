/**
 * The article breakpoint is stated twice — once as a number CSS can read, once as a token JS can.
 * It has to be: a `@media` condition is evaluated before custom properties exist, so
 * `@media (max-width: var(--vx-bp-article))` is not valid CSS and never will be. The literal is
 * therefore unavoidable; what IS avoidable is the two halves drifting, which is what this asserts.
 *
 * The CSS side is `BREAKPOINTS.article - 0.1`, not the bare number: the JS side
 * (`article-layout.tsx`'s `useSizeClass() === 'expanded'`) reads an inclusive
 * `min-width: 1200px`, so a bare `max-width: 1200px` here would ALSO be inclusive at exactly
 * 1200px — a width where BOTH the rail (JS) and the "hide the rail" rule (CSS) fire at once,
 * leaving neither the rail nor its trigger visible. The 0.1px offset is `tokens/size-classes.ts`'s
 * own `sizeClassMaxEm` convention, applied here as a plain px literal since this query cannot read
 * a token.
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
    const queries = css.match(/@media\s*\(max-width:\s*[\d.]+px\)/g) ?? []
    expect(queries).toHaveLength(1)
  })

  it('writes 0.1px under the number BREAKPOINTS.article declares — a strict complement of the JS min-width read, not the same number', () => {
    const match = css.match(/@media\s*\(max-width:\s*([\d.]+)px\)/)
    expect(match).not.toBeNull()
    expect(Number(match?.[1])).toBeCloseTo(BREAKPOINTS.article - 0.1, 5)
  })

  it('names the token beside the literal, so the next reader finds the other half', () => {
    expect(css).toContain('BREAKPOINTS.article')
  })

  /**
   * The regression this whole file exists to prevent: at exactly `BREAKPOINTS.article` px, the JS
   * `min-width` read and a bare CSS `max-width` read are BOTH inclusive, so both would fire — JS
   * renders the rail, CSS immediately hides it. The CSS boundary must fall strictly below the JS
   * one so no width silences both.
   */
  it('the CSS boundary is strictly below the JS min-width boundary', () => {
    const match = css.match(/@media\s*\(max-width:\s*([\d.]+)px\)/)
    expect(Number(match?.[1])).toBeLessThan(BREAKPOINTS.article)
  })
})

/**
 * The TOC trigger must sit at the TOP of the content, sharing `.content`'s own grid row — CSS
 * Grid's auto-placement used to land it in its own row BELOW the content instead (both
 * `.tocTrigger` and `.content` are `grid-column: 1`, and the auto-placement cursor moves past
 * `.content`'s row before `.tocTrigger` is placed). Pinned via an explicit `grid-row` on both
 * rather than relying on DOM order, which the article-layout.tsx comment used to (wrongly) claim
 * was sufficient.
 */
describe('article-layout.module.css — the TOC trigger sits at the top of the content', () => {
  const css = readFileSync(CSS_PATH, 'utf8')

  /**
   * The TOP-LEVEL rule only — `^` anchored (multiline), so the SAME selector's nested occurrence
   * inside the `@media (max-width: …)` block above (`.tocRail { display: none; }`, indented and
   * carrying no `grid-row` at all) is never the one matched instead of the real declaration.
   */
  function gridRowOf(selector: string): string | null {
    const rule = new RegExp(`^\\.${selector}\\s*\\{[^}]*\\}`, 'm').exec(css)?.[0] ?? ''
    return /grid-row:\s*([^;]+);/.exec(rule)?.[1]?.trim() ?? null
  }

  it('.tocTrigger declares an explicit grid-row', () => {
    expect(gridRowOf('tocTrigger')).not.toBeNull()
  })

  it('.tocTrigger and .content share the same explicit grid-row', () => {
    expect(gridRowOf('tocTrigger')).toBe(gridRowOf('content'))
  })

  it('.tocRail (the trigger above the breakpoint) shares that row too', () => {
    expect(gridRowOf('tocRail')).toBe(gridRowOf('content'))
  })
})
