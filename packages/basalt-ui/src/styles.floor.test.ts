/**
 * Regression test for the touch sheet (css/touch.css, imported by styles.css and tailwind.css): it
 * carries `touch-action: manipulation` and NO input font-size floor. A field is the density's size on
 * a phone as on a desktop; the iOS focus zoom is stopped in the head (`themeScript()`), never by
 * inflating the type.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'bun:test'

const SRC = dirname(fileURLToPath(import.meta.url))
const TOUCH_CSS_PATH = resolve(SRC, 'css/touch.css')

describe('touch.css', () => {
  const css = readFileSync(TOUCH_CSS_PATH, 'utf8')
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '')

  it('is imported by styles.css and by both generated sheets, in the basalt layer', () => {
    expect(readFileSync(resolve(SRC, 'styles.css'), 'utf8')).toContain(
      "@import './css/touch.css' layer(basalt);",
    )
    for (const sheet of ['tailwind.css', 'static.css']) {
      expect(readFileSync(resolve(SRC, 'css', sheet), 'utf8')).toContain(
        "@import './touch.css' layer(basalt);",
      )
    }
  })

  it('sets no font size, no !important and no coarse-pointer rule', () => {
    expect(code).not.toMatch(/font-size|!important|pointer: coarse/)
  })

  it('has no maximum-scale or user-scalable in the sheets: the head adds it on iOS only', () => {
    expect(code).not.toMatch(/maximum-scale|user-scalable/)
  })

  it('keeps touch-action: manipulation on the tappable elements', () => {
    expect(code).toMatch(/touch-action:\s*manipulation/)
  })
})
