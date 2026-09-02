/**
 * `TooltipHeader` — the `format` seam that lets a caller override `fmtTooltipDate`. Added because
 * `fmtTooltipDate` regexes `YYYY-MM-DD` out of the key and builds a LOCAL `Date`, so a UTC ISO
 * domain key names the wrong day next to `formatX`/the tooltip badge, which both resolve locally.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup, renderToString } from 'react-dom/server'
import { ChartTooltipFloat, TooltipHeader } from './ChartTooltip'

describe('TooltipHeader — format prop', () => {
  test('defaults to fmtTooltipDate when omitted', () => {
    const html = renderToStaticMarkup(<TooltipHeader date="2026-04-21" />)
    expect(html).toContain('Tue Apr 21 2026')
  })

  test('a custom format overrides fmtTooltipDate entirely', () => {
    const html = renderToStaticMarkup(
      <TooltipHeader date="2026-04-21" format={(d) => `custom:${d}`} />,
    )
    expect(html).toContain('custom:2026-04-21')
    expect(html).not.toContain('Tue Apr 21 2026')
  })
})

describe('ChartTooltipFloat — ariaLive', () => {
  test('defaults to an aria-live="polite" region', () => {
    render(
      <ChartTooltipFloat anchor={{ x: 10, y: 10 }}>
        <span>content</span>
      </ChartTooltipFloat>,
    )
    expect(screen.getByRole('tooltip').getAttribute('aria-live')).toBe('polite')
  })

  test('ariaLive: false drops the live-region attribute entirely — a follower is visual only', () => {
    render(
      <ChartTooltipFloat anchor={{ x: 10, y: 10 }} ariaLive={false}>
        <span>content</span>
      </ChartTooltipFloat>,
    )
    expect(screen.getByRole('tooltip').hasAttribute('aria-live')).toBe(false)
  })
})

/**
 * The one component in the package that could not be server-rendered (`isomorphic-findings.md`
 * F-SSR-1): `createPortal` THROWS in `react-dom/server`, and the guard has to be a server-snapshot
 * one — the DOM preload means `typeof document !== 'undefined'` here while `renderToString` still
 * refuses portals, so a document check would pass this file and fail a real server.
 */
describe('ChartTooltipFloat — server rendering', () => {
  test('renderToString does not throw on an ANCHORED tooltip (the portal case)', () => {
    expect(() =>
      renderToString(
        <ChartTooltipFloat anchor={{ x: 10, y: 10 }}>
          <span>content</span>
        </ChartTooltipFloat>,
      ),
    ).not.toThrow()
  })

  test('it emits nothing server-side — a hover artifact has no server markup', () => {
    const html = renderToString(
      <ChartTooltipFloat anchor={{ x: 10, y: 10 }}>
        <span>content</span>
      </ChartTooltipFloat>,
    )
    expect(html).not.toContain('content')
    expect(html).not.toContain('role="tooltip"')
  })

  test('a whole chart tooltip subtree server-renders — rows included, none of them emitted', () => {
    expect(() =>
      renderToString(
        <ChartTooltipFloat anchor={{ x: 0, y: 0 }} ariaLive={false}>
          <TooltipHeader date="2026-04-21" />
        </ChartTooltipFloat>,
      ),
    ).not.toThrow()
  })

  test('the client still portals — the guard is server-only, not a feature removal', () => {
    render(
      <ChartTooltipFloat anchor={{ x: 10, y: 10 }}>
        <span>client content</span>
      </ChartTooltipFloat>,
    )
    expect(screen.getByRole('tooltip').textContent).toBe('client content')
  })
})
