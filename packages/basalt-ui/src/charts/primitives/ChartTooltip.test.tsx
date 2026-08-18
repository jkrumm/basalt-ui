/**
 * `TooltipHeader` — the `format` seam that lets a caller override `fmtTooltipDate`. Added because
 * `fmtTooltipDate` regexes `YYYY-MM-DD` out of the key and builds a LOCAL `Date`, so a UTC ISO
 * domain key names the wrong day next to `formatX`/the tooltip badge, which both resolve locally.
 */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { TooltipHeader } from './ChartTooltip'

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
