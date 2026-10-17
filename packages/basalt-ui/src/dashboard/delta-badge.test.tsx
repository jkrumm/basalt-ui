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
    expect(screen.getByText('12.4%').style.getPropertyValue('--basalt-delta-tone')).toBe(
      'var(--vx-status-bad)',
    )
  })

  test('negative + up-bad renders the good tone', () => {
    render(<DeltaBadge value={-3.1} polarity="up-bad" />)
    expect(screen.getByText('▼')).toBeDefined()
    expect(screen.getByText('3.1%').style.getPropertyValue('--basalt-delta-tone')).toBe(
      'var(--vx-status-good)',
    )
  })

  test('any sign + neutral renders the faint tone', () => {
    render(<DeltaBadge value={12.4} polarity="neutral" />)
    expect(screen.getByText('12.4%').style.getPropertyValue('--basalt-delta-tone')).toBe(
      'var(--vx-faint)',
    )

    render(<DeltaBadge value={-3.1} polarity="neutral" />)
    expect(screen.getByText('3.1%').style.getPropertyValue('--basalt-delta-tone')).toBe(
      'var(--vx-faint)',
    )
  })

  test('zero renders the faint tone under every polarity', () => {
    for (const polarity of ['up-good', 'up-bad', 'neutral'] as const) {
      const { unmount } = render(<DeltaBadge value={0} polarity={polarity} />)
      expect(screen.getByText('0.0%').style.getPropertyValue('--basalt-delta-tone')).toBe(
        'var(--vx-faint)',
      )
      unmount()
    }
  })

  test('the glyph still shows ▲ for a positive value under up-bad', () => {
    render(<DeltaBadge value={12.4} polarity="up-bad" />)
    expect(screen.getByText('▲')).toBeDefined()
  })

  test('default polarity keeps the up-good tone (byte-identical to before)', () => {
    render(<DeltaBadge value={12.4} />)
    expect(screen.getByText('12.4%').style.getPropertyValue('--basalt-delta-tone')).toBe(
      'var(--vx-status-good)',
    )
  })
})

test('period renders after the value, in the same badge', () => {
  render(<DeltaBadge value={4.2} period="MoM" />)
  expect(screen.getByText('4.2%')).toBeDefined()
  expect(screen.getByText('MoM')).toBeDefined()
})

test('omitting period renders no extra text', () => {
  render(<DeltaBadge value={4.2} />)
  expect(screen.queryByText('MoM')).toBeNull()
})

/** WCAG 2.x relative luminance / contrast, for the trend-colour floor below. */
function luminance(hex: string): number {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** `color-mix(in srgb, a, b 12%)` — the same mix the badge paints. */
function mixToward(a: string, b: string, share: number): string {
  const ch = (hex: string, i: number): number => Number.parseInt(hex.slice(i, i + 2), 16)
  const out = [1, 3, 5].map((i) => Math.round(ch(a, i) * (1 - share) + ch(b, i) * share))
  return `#${out.map((v) => v.toString(16).padStart(2, '0')).join('')}`
}
const contrast = (a: string, b: string): number => {
  const [hi = 0, lo = 0] = [luminance(a), luminance(b)].toSorted((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

// DESIGN-CORE: "deltas are text colour only, never a fill" — in either scheme, at any sign.
describe('the delta is text only, no fill (ledger row 162)', () => {
  test.each([12.4, -3.1, 0])('%p paints a colour and no background', (value) => {
    const { container } = render(<DeltaBadge value={value} period="MoM" />)
    const badge = container.firstElementChild as HTMLElement
    expect(badge.style.getPropertyValue('--basalt-delta-tone')).not.toBe('')
    expect(badge.getAttribute('style') ?? '').not.toMatch(/background/)
  })

  test('the stylesheet gives the badge no background, padding, border or radius', () => {
    const css = readFileSync(
      resolve(import.meta.dirname, 'widget-header.module.css'),
      'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '')
    const start = css.indexOf('.deltaBadge {')
    expect(start).toBeGreaterThan(-1)
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).not.toMatch(/background|padding|border/)
    // the 12% ink share the contrast test below assumes
    expect(rule).toContain('color-mix(in srgb, var(--basalt-delta-tone), var(--vx-ink) 12%)')
  })

  test('the glyph is on the micro rung, not 0.8em of whatever it sits in', () => {
    const css = readFileSync(resolve(import.meta.dirname, 'widget-header.module.css'), 'utf8')
    const start = css.indexOf('.deltaGlyph {')
    const rule = css.slice(start, css.indexOf('}', start))
    expect(rule).toContain('font-size: var(--vx-text-micro)')
    expect(rule).not.toContain('em')
  })

  test.each(['light', 'dark'] as const)(
    'the good and bad trend colours clear 4.5:1 on the card surface (%s)',
    (scheme) => {
      for (const tone of ['good', 'bad'] as const) {
        const painted = mixToward(STATUS[tone][scheme], INK.ink[scheme], 0.12)
        expect(contrast(painted, SURFACE.panel[scheme])).toBeGreaterThanOrEqual(4.5)
      }
    },
  )
})
