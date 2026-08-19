/**
 * `TooltipHeader` — the `format` seam that lets a caller override `fmtTooltipDate`. Added because
 * `fmtTooltipDate` regexes `YYYY-MM-DD` out of the key and builds a LOCAL `Date`, so a UTC ISO
 * domain key names the wrong day next to `formatX`/the tooltip badge, which both resolve locally.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
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
