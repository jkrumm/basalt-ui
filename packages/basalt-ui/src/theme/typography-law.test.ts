/**
 * Wave 37 type and focus laws that live in `styles.css`: a slashed zero only in mono text, no mono
 * ligatures in data text, and the chart's focus ring (in `chart-box.module.css`) as the focus token in dark.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** The chart ring lives with the chart's own CSS: the engine focuses `svg.ts-chart`, not the wrapper. */
const chartBoxCss = readFileSync(
  resolve(import.meta.dirname, '../charts/chart-box.module.css'),
  'utf8',
).replaceAll(/\/\*[\s\S]*?\*\//g, '')

const css = readFileSync(resolve(import.meta.dirname, '../styles.css'), 'utf8').replaceAll(
  /\/\*[\s\S]*?\*\//g,
  '',
)

/** The declaration block of the first rule whose selector list contains `needle`. */
function ruleFor(needle: string, source = css): string {
  const re = /([^{}]+)\{([^{}]*)\}/g
  for (const [, selector, body] of source.matchAll(re)) {
    if (selector?.includes(needle)) return body ?? ''
  }
  return ''
}

/** Every rule whose selector list contains `needle` as a whole selector. */
function rulesFor(needle: string): string[] {
  const out: string[] = []
  for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const list = (selector ?? '').split(',').map((s) => s.trim())
    if (list.includes(needle)) out.push(body ?? '')
  }
  return out
}

describe('no slashed zero in the head face', () => {
  test('a digits-only sans face leads the head stack (Hubot has no `zero` feature to reset)', () => {
    expect(css).toMatch(
      /@font-face\s*\{[^}]*font-family:\s*'Basalt Head Digits'[^}]*nunito-sans-latin-wght-normal\.woff2[^}]*unicode-range:\s*U\+0030-0039/,
    )
    expect(rulesFor(':root').join(' ')).toMatch(
      /--basalt-font-head:\s*'Basalt Head Digits',\s*'Hubot Sans Variable'/,
    )
  })

  test('nothing turns it back on', () => {
    expect(css).not.toMatch(/'zero'\s*1/)
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

describe('body sans keeps its ligatures', () => {
  test.each([':root', 'html', 'body', '*', 'p'])('%s does not switch them off', (selector) => {
    expect(rulesFor(selector).join(' ')).not.toContain('font-variant-ligatures')
  })
})

describe('the chart focus ring', () => {
  test('is the focus token, not the UA ring (white in dark)', () => {
    const body = ruleFor('.basalt-chart .ts-chart:focus-visible', chartBoxCss)
    expect(body).toMatch(/outline:\s*2px solid var\(--vx-accent\)/)
    // Inset: an outer ring is clipped by the card body at the plot's right and bottom edges.
    expect(body).toContain('outline-offset: calc(-0.125rem * var(--mantine-scale))')
  })

  test('is the plot svg only, not its descendants, and no dead wrapper rule remains', () => {
    expect(css).not.toContain('.basalt-chart :focus-visible')
    expect(chartBoxCss).not.toContain('.basalt-chart :focus-visible')
    expect(css).not.toContain('.basalt-chart:focus-visible')
  })
})
