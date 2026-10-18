/**
 * Wave 37 type and focus laws that live in `styles.css`: a slashed zero only in mono text, no mono
 * ligatures in data text, and the chart host's focus ring as the focus token in dark.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(import.meta.dirname, '../styles.css'), 'utf8')

/** The declaration block of the first rule whose selector list contains `needle`. */
function ruleFor(needle: string): string {
  const re = /([^{}]+)\{([^{}]*)\}/g
  for (const [, selector, body] of css.matchAll(re)) {
    if (selector?.includes(needle)) return body ?? ''
  }
  return ''
}

describe('slashed zero only in data text', () => {
  test(':root resets the zero feature, so a non-heading title inherits a plain zero', () => {
    const root = css.match(/:root\s*\{[^}]*font-feature-settings:\s*'zero'\s*0/)
    expect(root).not.toBeNull()
  })

  test('mono data text opts back in to the zero feature', () => {
    const body = ruleFor('pre')
    expect(body).toContain("'zero'")
  })
})

describe('mono ligatures are off for data text', () => {
  test.each(['code', 'kbd', '[data-numeric]', 'font-family-monospace', 'basalt-font-mono'])(
    '%s',
    (needle) => {
      const rule = css.match(
        new RegExp(
          `[^{}]*${needle.replace(/[[\]]/g, '\\$&')}[^{}]*\\{[^}]*font-variant-ligatures:\\s*none`,
        ),
      )
      expect(rule).not.toBeNull()
    },
  )
})

describe('the chart host focus ring', () => {
  test('is the focus token, not the UA ring (white in dark)', () => {
    const body = ruleFor('.basalt-chart:focus-visible')
    expect(body).toMatch(/outline:\s*2px solid var\(--vx-accent\)/)
  })
})
