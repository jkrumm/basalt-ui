/**
 * Wave 34: status is a dot plus a word, never a coloured edge. Pins the stylesheets that used to
 * draw one so a regression fails here, not in review.
 */
import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// A leading-edge stripe: a border on the start side, an edge pseudo-element, an inset box-shadow
// or a border-image.
const EDGE =
  /border-left|border-inline-start|::before|::after|border-image|box-shadow:\s*inset|inset[^;]*box-shadow/

const strip = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, '')

test('the matcher fires on known-bad fixtures', () => {
  for (const bad of [
    '.x { border-left: 2px solid red }',
    '.x { border-inline-start-width: 3px }',
    '.x { border-image: linear-gradient(red, red) 1 }',
    '.x { box-shadow: inset 3px 0 0 red }',
    '.x::before { content: "" }',
  ]) {
    expect(bad).toMatch(EDGE)
  }
})

for (const file of ['dashboard/stat-card.module.css', 'content/callout.module.css']) {
  test(`${file} draws no edge stripe`, () => {
    const css = strip(readFileSync(join(import.meta.dir, '..', file), 'utf8'))
    expect(css).not.toMatch(EDGE)
  })
}
