/**
 * V2-SPEC § 5 source pin: `styles.css` removes view-transition animation under
 * `prefers-reduced-motion: reduce`, and the block sits inside `@layer basalt` (React does not do it).
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'

const css = readFileSync(join(import.meta.dir, 'styles.css'), 'utf8')

/** The body of the `@layer basalt { … }` block that contains `needle`. */
function layerBlockContaining(needle: string): string {
  const at = css.indexOf(needle)
  if (at === -1) return ''
  let start = -1
  for (let i = css.lastIndexOf('@layer basalt {', at); i !== -1;) {
    start = i
    break
  }
  if (start === -1) return ''
  let depth = 0
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++
    if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1)
  }
  return ''
}

describe('styles.css reduced-motion view transitions', () => {
  const block = layerBlockContaining('::view-transition-group(*)')

  test('the block exists inside @layer basalt', () => {
    expect(block.startsWith('@layer basalt {')).toBe(true)
  })

  test('it gates on prefers-reduced-motion: reduce and silences group, old and new', () => {
    const media = block.slice(block.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(media).toContain('::view-transition-group(*)')
    expect(media).toContain('::view-transition-old(*)')
    expect(media).toContain('::view-transition-new(*)')
    expect(media).toMatch(/animation:\s*none/)
  })
})

describe('styles.css route transitions', () => {
  const block = layerBlockContaining('basalt-route-out 120ms')
  const motion = block.slice(block.indexOf('@media (prefers-reduced-motion: no-preference)'))
  /** The `@media` body: from its opening brace to the matching close. */
  const mediaBody = (() => {
    let depth = 0
    const open = motion.indexOf('{')
    for (let i = open; i < motion.length; i++) {
      if (motion[i] === '{') depth++
      if (motion[i] === '}' && --depth === 0) return motion.slice(open, i + 1)
    }
    return ''
  })()

  test('every route animation sits inside the no-preference query, so reduce keeps `animation: none`', () => {
    expect(mediaBody).toContain('basalt-route-out')
    expect(mediaBody).toContain('basalt-route-in')
    const outside = block.replace(mediaBody, '')
    expect(outside).not.toMatch(/animation:\s*basalt-route/)
  })

  test('the content region is named only while a basalt route type is active', () => {
    expect(block).toMatch(
      /:root:active-view-transition-type\(basalt-forward, basalt-back, basalt-sibling\)\s*\[data-basalt-scrollport\]\s*\{\s*view-transition-name: basalt-main;/,
    )
    expect(css.match(/view-transition-name:/g)).toHaveLength(1)
  })

  test('the type names match the ones the router callback emits', async () => {
    const { ROUTE_TRANSITION_TYPES } = await import('./provider/route-transition')
    for (const type of Object.values(ROUTE_TRANSITION_TYPES)) expect(css).toContain(type)
  })

  test('RTL flips the slide: forward and back swap sign, sibling stays 0', () => {
    expect(css).toMatch(
      /:root\[dir='rtl'\]:active-view-transition-type\(basalt-forward\)\s*\{\s*--basalt-route-shift: -8px;/,
    )
    expect(css).toMatch(
      /:root\[dir='rtl'\]:active-view-transition-type\(basalt-back\)\s*\{\s*--basalt-route-shift: 8px;/,
    )
    expect(css).not.toMatch(/\[dir='rtl'\]:active-view-transition-type\(basalt-sibling\)/)
  })
})
