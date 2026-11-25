/**
 * The cursor law ships in every sheet a consumer can load: `styles.css` and both generated sheets import
 * `css/cursor.css` into the basalt layer. The computed cursors are asserted in real Chrome by
 * `tests/layout/cursor.layout.test.ts`.
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'bun:test'

const SRC = dirname(fileURLToPath(import.meta.url))

describe('cursor.css', () => {
  it('is imported by styles.css and by both generated sheets, in the basalt layer', () => {
    expect(readFileSync(resolve(SRC, 'styles.css'), 'utf8')).toContain(
      "@import './css/cursor.css' layer(basalt);",
    )
    for (const sheet of ['tailwind.css', 'static.css']) {
      expect(readFileSync(resolve(SRC, 'css', sheet), 'utf8')).toContain(
        "@import './cursor.css' layer(basalt);",
      )
    }
  })

  it('gives a pointer to a button and a row that opens, and not-allowed to a disabled one', () => {
    const css = readFileSync(resolve(SRC, 'css/cursor.css'), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    expect(css).toMatch(/\bbutton,[\s\S]*?\[data-activatable\][\s\S]*?\{\s*cursor: pointer;/)
    expect(css).toContain('cursor: not-allowed;')
    expect(css).toContain("[draggable='true']")
  })
})
