/**
 * `DeltaBadge` — sign-driven tone/glyph, `withGlyph`, custom `format`, and `period` (docs/
 * DESIGN-SPEC.md §5). Mantine-free, so no `MantineProvider` wrapper is needed.
 *
 * CSS-module class hashes are unavailable under `bun test` (see `app-mobile-nav.test.tsx`'s doc) —
 * every query below goes through text content, never `classes.*`.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { contrastRatio } from '../tokens/hct'
import { INK, STATUS, SURFACE } from '../tokens/palette'
import { DeltaBadge } from './delta-badge'

describe('sign drives tone and glyph', () => {
  test('positive renders the up glyph and the formatted magnitude', () => {
    render(<DeltaBadge value={12.4} />)
    expect(screen.getByText('▲')).toBeDefined()
    expect(screen.getByText('12.4%')).toBeDefined()
  })

  test('negative renders the down glyph and the formatted magnitude', () => {
    render(<DeltaBadge value={-3.1} />)
    expect(screen.getByText('▼')).toBeDefined()
    expect(screen.getByText('3.1%')).toBeDefined()
  })

  test('zero renders the formatted magnitude with no glyph', () => {
    render(<DeltaBadge value={0} />)
    expect(screen.getByText('0.0%')).toBeDefined()
    expect(screen.queryByText('▲')).toBeNull()
    expect(screen.queryByText('▼')).toBeNull()
  })
})

test('withGlyph={false} suppresses the glyph even for a signed value', () => {
  render(<DeltaBadge value={12.4} withGlyph={false} />)
  expect(screen.getByText('12.4%')).toBeDefined()
  expect(screen.queryByText('▲')).toBeNull()
})

test('a zero value never shows a glyph, even with withGlyph={true}', () => {
  render(<DeltaBadge value={0} withGlyph={true} />)
  expect(screen.queryByText('▲')).toBeNull()
  expect(screen.queryByText('▼')).toBeNull()
})

test('a custom format overrides the default percentage label', () => {
  render(<DeltaBadge value={182} format={(v) => `${Math.abs(v)}ms`} withGlyph={false} />)
  expect(screen.getByText('182ms')).toBeDefined()
  expect(screen.queryByText('182.0%')).toBeNull()
})

describe('polarity', () => {
  test('positive + up-bad renders the bad tone', () => {
    render(<DeltaBadge value={12.4} polarity="up-bad" />)
    expect(screen.getByText('▲')).toBeDefined()
    expect(screen.getByText('12.4%').style.color).toBe('var(--vx-status-bad)')
  })

  test('negative + up-bad renders the good tone', () => {
    render(<DeltaBadge value={-3.1} polarity="up-bad" />)
    expect(screen.getByText('▼')).toBeDefined()
    expect(screen.getByText('3.1%').style.color).toBe('var(--vx-status-good)')
  })

  test('any sign + neutral renders the faint tone', () => {
    render(<DeltaBadge value={12.4} polarity="neutral" />)
    expect(screen.getByText('12.4%').style.color).toBe('var(--vx-faint)')

    render(<DeltaBadge value={-3.1} polarity="neutral" />)
    expect(screen.getByText('3.1%').style.color).toBe('var(--vx-faint)')
  })

  test('zero renders the faint tone under every polarity', () => {
    for (const polarity of ['up-good', 'up-bad', 'neutral'] as const) {
      const { unmount } = render(<DeltaBadge value={0} polarity={polarity} />)
      expect(screen.getByText('0.0%').style.color).toBe('var(--vx-faint)')
      unmount()
    }
  })

  test('the glyph still shows ▲ for a positive value under up-bad', () => {
    render(<DeltaBadge value={12.4} polarity="up-bad" />)
    expect(screen.getByText('▲')).toBeDefined()
  })

  test('default polarity keeps the up-good tone (byte-identical to before)', () => {
    render(<DeltaBadge value={12.4} />)
    expect(screen.getByText('12.4%').style.color).toBe('var(--vx-status-good)')
  })
})

describe('period composes "vs <period>"', () => {
  test('period="last week" renders "vs last week" in the same badge', () => {
    render(<DeltaBadge value={4.2} period="last week" />)
    expect(screen.getByText('4.2%')).toBeDefined()
    expect(screen.getByText('vs last week')).toBeDefined()
  })

  test('the full phrase is readable as one badge text (a11y)', () => {
    const { container } = render(<DeltaBadge value={4.2} withGlyph={false} period="last week" />)
    expect(container.firstElementChild?.textContent).toBe('4.2%vs last week')
  })

  test('a period already starting with the prefix is not doubled', () => {
    render(<DeltaBadge value={4.2} period="vs last week" />)
    expect(screen.getByText('vs last week')).toBeDefined()
    expect(screen.queryByText('vs vs last week')).toBeNull()
  })

  test('periodPrefix overrides the word; an empty prefix renders the period raw', () => {
    const { unmount } = render(
      <DeltaBadge value={4.2} period="Vorwoche" periodPrefix="gegenüber" />,
    )
    expect(screen.getByText('gegenüber Vorwoche')).toBeDefined()
    unmount()
    render(<DeltaBadge value={4.2} period="MoM" periodPrefix="" />)
    expect(screen.getByText('MoM')).toBeDefined()
  })
})

test('omitting period renders no extra text', () => {
  render(<DeltaBadge value={4.2} />)
  expect(screen.queryByText('MoM')).toBeNull()
})

// DESIGN-CORE: "deltas are text colour only, never a fill" — in either scheme, at any sign.
describe('the delta is text only, no fill (ledger row 162)', () => {
  test.each([12.4, -3.1, 0])('%p paints a status token and no background', (value) => {
    const { container } = render(<DeltaBadge value={value} period="MoM" />)
    const badge = container.firstElementChild as HTMLElement
    expect(badge.style.color).toMatch(/^var\(--vx-(status-(good|bad)|faint)\)$/)
    expect(badge.getAttribute('style') ?? '').not.toMatch(/background/)
  })

  const css = readFileSync(resolve(import.meta.dirname, 'widget-header.module.css'), 'utf8')
  const decls = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rule = (selector: string): string => {
    const start = decls.indexOf(`${selector} {`)
    expect(start).toBeGreaterThan(-1)
    return decls.slice(start, decls.indexOf('}', start))
  }

  test('the stylesheet gives the badge no background, padding, border, radius or colour mix', () => {
    expect(rule('.deltaBadge')).not.toMatch(/background|padding|border|color-mix|color:/)
  })

  test('the glyph is on the micro rung, not 0.8em of whatever it sits in', () => {
    const r = rule('.deltaGlyph')
    expect(r).toContain('font-size: var(--vx-text-micro)')
    expect(r).not.toContain('em')
  })

  // The colour is the derived token itself (`derive.ts` pins the ratios); this proves the shipped
  // palette the badge reads, including the neutral/zero `faint`, clears the text floor on the card.
  test.each(['light', 'dark'] as const)(
    'good, bad and faint clear 4.5:1 on the card surface (%s)',
    (scheme) => {
      for (const painted of [STATUS.good[scheme], STATUS.bad[scheme], INK.faint[scheme]]) {
        expect(contrastRatio(painted, SURFACE.panel[scheme])).toBeGreaterThanOrEqual(4.5)
      }
    },
  )
})
