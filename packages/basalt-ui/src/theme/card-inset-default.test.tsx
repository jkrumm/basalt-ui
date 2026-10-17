/**
 * Wave 35 (ledger rows 163, 165): the THEME owns the card inset. A bare `<Card>` (Mantine: 16 px
 * all round) and a bare `<Paper>` (Mantine: 0) both resolve to the 12/16 law —
 * `--vx-space-card-inset-y` / `-x`, which `density` scales — so a consumer states nothing. Flush is
 * `variant="flush"` (whole card) or `Card.Section` (a full-bleed region inside a padded card).
 *
 * Bun resolves `.module.css` to `{}` and happy-dom computes no stylesheet, so the geometry itself is
 * pinned in `tests/layout/card-inset.layout.test.ts` (real Chrome); here the contract is the wiring
 * the theme attaches and the declarations the CSS carries.
 */
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { baseTheme } from './index'

const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'card-inset.module.css'),
  'utf8',
)

describe('the theme wires the inset onto Card and Paper', () => {
  // `.module.css` imports are `{}` under bun, so the class VALUES are undefined here; the keys are
  // the wiring, and the CSS text below is the contract the layout suite then measures.
  test('Card attaches root + section, Paper attaches root', () => {
    expect(Object.keys(baseTheme.components?.['Card']?.classNames ?? {}).sort()).toEqual([
      'root',
      'section',
    ])
    expect(Object.keys(baseTheme.components?.['Paper']?.classNames ?? {})).toEqual(['root'])
  })
})

describe('the inset declarations', () => {
  test('the pair is the density-scaled y/x tokens with the level-0 12/16 fallbacks', () => {
    expect(css).toContain('var(--vx-space-card-inset-y, 12px)')
    expect(css).toContain('var(--vx-space-card-inset-x, 16px)')
    expect(css).toContain('padding: var(--card-inset-y) var(--card-inset-x)')
  })

  test('a Card padding prop (inline --card-padding) still wins over the token', () => {
    expect(css).toMatch(/\.inset\.inset\s*\{\s*--card-padding:\s*initial/)
    expect(css).toContain('var(--card-padding, var(--vx-space-card-inset-y')
  })

  test('variant="flush" zeroes the padding', () => {
    expect(css).toMatch(/\[data-variant='flush'\][^{]*\{[^}]*padding:\s*0/)
  })

  test('Card.Section cancels the same x/y, not one --card-padding', () => {
    expect(css).toContain('calc(var(--card-inset-x, 16px) * -1)')
    expect(css).toContain('calc(var(--card-inset-y, 12px) * -1)')
  })

  test('the Paper-rendering exclusions are named (their padding is measured in the layout suite)', () => {
    for (const part of ['Modal', 'Drawer', 'Dialog', 'ActionBar', 'FloatingWindow']) {
      expect(css).toContain(`mantine-${part}-`)
    }
  })
})
