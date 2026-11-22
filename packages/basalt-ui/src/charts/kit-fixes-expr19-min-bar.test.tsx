/**
 * Expression cycle 19 (`v3-expr-19-kit-fixes` 3): a bar of a non-zero value never reads as none. One a few
 * hundredths of the domain draws a bar at least as tall as the zero bar's tick and taller.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Bars } from './parts/bars'

const COLOR = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }
type Row = { k: string; a: number }

const render = (data: readonly Row[], layout: 'grouped' | 'stacked' = 'grouped'): string =>
  renderToString(
    <Bars<Row>
      label="V"
      data={data}
      x={{ value: (d) => d.k }}
      layout={layout}
      series={[{ mark: 'bar', key: 'a', label: 'A', color: COLOR, y: (d) => d.a }]}
    />,
  )

/** The heights of the rects drawn under a mark key, in px. */
const heights = (html: string, key: string): number[] =>
  [...html.matchAll(new RegExp(`<rect data-ts-key="${key}[^"]*"[^>]*height="([\\d.]+)"`, 'g'))].map(
    (m) => Number(m[1]),
  )

describe('a non-zero bar next to a tall one', () => {
  const data: readonly Row[] = [
    { k: 'none', a: 0 },
    { k: 'one', a: 1 },
    { k: 'two', a: 2 },
    { k: 'many', a: 400 },
  ]

  test('is drawn at least 4 px tall, above the zero bar tick', () => {
    for (const layout of ['grouped', 'stacked'] as const) {
      const html = render(data, layout)
      const min = heights(html, 'min-bars')
      expect(min.length, layout).toBeGreaterThan(0)
      for (const h of min) expect(h, layout).toBeGreaterThanOrEqual(3.5)
      const tick = heights(html, 'zero-ticks')
      expect(Math.min(...min), layout).toBeGreaterThan(Math.max(...tick))
    }
  })

  test('a bar tall enough on its own draws no minimum bar', () => {
    const html = render([
      { k: 'a', a: 50 },
      { k: 'b', a: 400 },
    ])
    expect(html).not.toContain('min-bars')
  })
})
