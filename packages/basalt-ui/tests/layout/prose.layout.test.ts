/**
 * `prose.css` in the cascade (docs/v3/concepts/static-framework-free.md section 1 row 5, section 8 P1).
 * Prose sits at specificity zero inside `basalt.prose`, so any app rule wins without a fight:
 * an unlayered `.steps > *` (0-1-0) beats it, a `utilities`-layer `.mt-2` beats it, and a plain
 * sibling still gets the rhythm. The page declares the layer order `theme, base, basalt,
 * components, utilities`; the outcome is a resolved computed style in Chrome.
 */
import { afterAll, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CLOSE_BUDGET_MS,
  DESKTOP_1440,
  closeLayoutSuite,
  initLayoutSuite,
  openDocument,
} from './harness'
import type { LayoutPage } from './harness'

const ready = await initLayoutSuite()
const layout = ready ? describe : describe.skip

afterAll(closeLayoutSuite, CLOSE_BUDGET_MS)

const CSS_DIR = new URL('../../src/css/', import.meta.url).pathname
const PROSE = readFileSync(join(CSS_DIR, 'prose.css'), 'utf8')
const TOKENS = readFileSync(join(CSS_DIR, 'tokens.css'), 'utf8')

const DOCUMENT =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>prose</title><style>' +
  '@layer theme, base, basalt, components, utilities;\n' +
  `@layer theme {\n${TOKENS}\n}\n${PROSE}\n` +
  '@layer utilities { .mt-2 { margin-block-start: 8px; } }\n' +
  '.steps > * { margin-block-start: 0; }\n' +
  '</style></head><body>' +
  '<article class="vx-prose">' +
  '<p id="first">First</p>' +
  '<p id="sibling">Second</p>' +
  '<div class="steps"><p id="stepped">Step</p><p id="stepped-2">Step two</p></div>' +
  '<p id="util" class="mt-2">Utility</p>' +
  '</article></body></html>'

/** Strips every top-level `:where(...)` group; what remains is the selector's specificity. */
function outsideWhere(selector: string): string {
  let depth = 0
  let kept = ''
  for (let i = 0; i < selector.length; i++) {
    if (depth === 0 && selector.startsWith(':where(', i)) {
      depth = 1
      i += ':where('.length - 1
      continue
    }
    const ch = selector[i]!
    if (depth > 0) {
      if (ch === '(') depth++
      else if (ch === ')') depth--
    } else {
      kept += ch
    }
  }
  return kept.trim()
}

describe('prose.css source', () => {
  const selectors = PROSE.split('\n')
    .filter((line) => line.endsWith('{') && !line.trimStart().startsWith('@'))
    .map((line) => line.trim().replace(/\s*\{$/, ''))

  test('every selector is :where() alone, so its specificity is 0-0-0', () => {
    expect(selectors.length).toBeGreaterThan(30)
    for (const selector of selectors) {
      expect(outsideWhere(selector), selector).toBe('')
    }
  })

  test('no declaration is !important and no raw hex colour is written', () => {
    expect(PROSE).not.toContain('!important')
    expect(PROSE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })
})

// The harness closes a test's page after the test, so every test opens its own.
const marginTop = async (selector: string): Promise<string> => {
  const p: LayoutPage = await openDocument(DOCUMENT, DESKTOP_1440)
  return p.computed(selector, 'margin-top')
}

layout('prose in the cascade', () => {
  test('a plain sibling gets the paragraph rhythm: --vx-rhythm-2 (1.25em of the 16px base)', async () => {
    expect(await marginTop('#sibling')).toBe('20px')
  })

  test('a descendant matched by an unlayered .steps > * (0-1-0) gets 0px', async () => {
    expect(await marginTop('#stepped')).toBe('0px')
  })

  test('a utilities-layer .mt-2 beats basalt.prose', async () => {
    expect(await marginTop('#util')).toBe('8px')
  })
})
