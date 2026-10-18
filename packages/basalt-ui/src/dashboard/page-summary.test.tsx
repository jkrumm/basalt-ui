/**
 * `PageSummary` — SPEC § 6.9's page-summary recipe: a headline sentence that carries a live number,
 * an optional facts line, an optional aside, a loading skeleton of the same shape. Argo is the named
 * consumer (UPSTREAM § Wave 24-26).
 */
import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReactElement } from 'react'
import { PageSummary } from './page-summary'

const renderWith = (node: ReactElement) => render(<MantineProvider>{node}</MantineProvider>)

const css = readFileSync(join(import.meta.dirname, 'page-summary.module.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
)

describe('PageSummary', () => {
  test('renders the sentence as an h2 headline', () => {
    renderWith(<PageSummary sentence="12 open, 3 need you" />)
    expect(screen.getByRole('heading', { level: 2, name: '12 open, 3 need you' })).toBeDefined()
  })

  test('renders facts in order and drops null / false / undefined / empty ones', () => {
    renderWith(
      <PageSummary
        sentence="12 open"
        facts={['3 need you', null, false, undefined, '', 'oldest 2 d']}
      />,
    )
    const facts = [...document.querySelectorAll('[data-page-summary-fact]')].map(
      (el) => el.textContent,
    )
    expect(facts).toEqual(['3 need you', 'oldest 2 d'])
  })

  test('no facts line at all when every fact drops', () => {
    renderWith(<PageSummary sentence="12 open" facts={[null, false]} />)
    expect(document.querySelector('[data-page-summary-facts]')).toBeNull()
  })

  test('the aside sits beside the headline', () => {
    renderWith(<PageSummary sentence="12 open" aside="Today" />)
    expect(screen.getByText('Today')).toBeDefined()
  })

  test('loading renders a busy skeleton of the same shape and no content', () => {
    renderWith(<PageSummary loading />)
    const root = document.querySelector('[data-page-summary]')
    expect(root?.getAttribute('aria-busy')).toBe('true')
    expect(screen.queryByRole('heading')).toBeNull()
  })

  test('loading keeps a facts-line skeleton when facts are expected', () => {
    renderWith(<PageSummary loading facts={['x']} />)
    expect(document.querySelectorAll('.mantine-Skeleton-root').length).toBe(2)
  })
})

describe('PageSummary CSS (typography law D33, separator law)', () => {
  const rule = (selector: string): string => {
    const start = css.indexOf(`${selector} {`)
    expect(start, `${selector} rule exists`).toBeGreaterThan(-1)
    return css.slice(start, css.indexOf('}', start))
  }

  test('the sentence is the head face at the page-headline size, not mono', () => {
    const r = rule('.sentence')
    expect(r).toContain('var(--basalt-font-head)')
    expect(r).toContain('letter-spacing: -0.02em')
    expect(r).not.toContain('mono')
  })

  test('facts are sans xs muted, never mono or tabular', () => {
    const r = rule('.facts')
    expect(r).toContain('var(--vx-text-xs)')
    expect(r).toContain('var(--vx-muted)')
    expect(r).not.toContain('mono')
    expect(r).not.toContain('tabular-nums')
  })

  test('the separator is a pseudo-element on every fact, never a text node', () => {
    expect(css).toMatch(/\.fact::before\s*\{[^}]*content:\s*'·'/)
    expect(css).not.toMatch(/\.fact\s*\+\s*\.fact/)
  })

  test('the dot sits in the gap BEFORE its fact and the list clips inline overflow, so a line-leading dot is cut', () => {
    // First fact on any line starts at the list's left edge; its dot box is the gap to the left of that
    // edge, i.e. outside the clip. A mid-line fact's dot is inside the preceding gap.
    expect(rule('.fact::before')).toMatch(/inset-inline-start:\s*calc\(-1 \* var\(--facts-gap\)\)/)
    expect(rule('.fact::before')).toMatch(/width:\s*var\(--facts-gap\)/)
    expect(rule('.facts')).toMatch(/overflow-x:\s*clip/)
    expect(rule('.facts')).toMatch(/flex-wrap:\s*wrap/)
  })

  test('the dot is placed logically: no physical translate that flips wrong under rtl', () => {
    expect(rule('.fact::before')).not.toMatch(/translate|\bleft\b|\bright\b/)
  })

  test('a focus ring on a link inside a fact is drawn inside the clip', () => {
    expect(css).toMatch(/\.fact\s+:where\([^)]*\):focus-visible\s*\{[^}]*outline-offset:\s*-2px/)
  })
})
