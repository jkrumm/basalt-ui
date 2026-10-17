/**
 * Wave 34: status is a dot plus a word, never a coloured edge. Pins the two stylesheets that used to
 * draw one so a regression fails here, not in review.
 */
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const EDGE = /border-left|border-inline-start|::before|::after/

for (const file of ['dashboard/stat-card.module.css', 'content/callout.module.css']) {
  test(`${file} draws no edge stripe`, () => {
    const css = readFileSync(join(import.meta.dir, '..', file), 'utf8').replace(
      /\/\*[\s\S]*?\*\//g,
      '',
    )
    expect(css).not.toMatch(EDGE)
  })
}
