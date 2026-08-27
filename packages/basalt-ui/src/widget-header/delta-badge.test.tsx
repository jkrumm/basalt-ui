/**
 * `DeltaBadge` — sign-driven tone/glyph, `withGlyph`, custom `format`, and `period` (docs/
 * DESIGN-SPEC.md §5). Mantine-free, so no `MantineProvider` wrapper is needed.
 *
 * CSS-module class hashes are unavailable under `bun test` (see `app-mobile-nav.test.tsx`'s doc) —
 * every query below goes through text content, never `classes.*`.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
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

test('period renders after the value, in the same badge', () => {
  render(<DeltaBadge value={4.2} period="MoM" />)
  expect(screen.getByText('4.2%')).toBeDefined()
  expect(screen.getByText('MoM')).toBeDefined()
})

test('omitting period renders no extra text', () => {
  render(<DeltaBadge value={4.2} />)
  expect(screen.queryByText('MoM')).toBeNull()
})
