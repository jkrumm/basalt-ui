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
