/**
 * Expression cycle 17 (`v3-expr-17-kit-fixes` 3, n81 and n82): the caret of a clamped bar sits inside the
 * bar's own body, so it is cut in the card's color; in the bar's color it is the bar's. A caret on a
 * dot, which has no body, keeps the series color.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Bars } from './index'

type Row = { k: string; a: number }
const rows: Row[] = Array.from({ length: 3 }, (_, i) => ({ k: 'k' + i, a: i === 1 ? 35 : 3 }))
const INK = { light: '#6b6b6b', dark: '#a8a8a8' }

/** The `fill` of the text mark with this key. */
const fillOf = (html: string, key: string): string | undefined =>
  new RegExp(`<text data-ts-key="${key}[^"]*"[^>]*?fill="([^"]*)"`).exec(html)?.[1]

describe('a clamp caret', () => {
  test('on an ink-step bar is cut in the card color', () => {
    const html = renderToString(
      <Bars<Row>
        label="V"
        data={rows}
        x={{ value: (d) => d.k }}
        y={{ domain: [0, 20] }}
        layout="grouped"
        series={[{ mark: 'bar', key: 'a', label: 'A', color: INK, y: (d) => d.a }]}
      />,
    )
    expect(fillOf(html, 'off-scale-a-top')).toBe('var(--basalt-card)')
  })
})
