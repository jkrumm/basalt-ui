/**
 * Expression cycle 17 (`v3-expr-17-kit-fixes` 5, n82 quiet and n84 spike at 390): a value label that a rule
 * crosses sits on a card-colored backing and the vertical rules are drawn under the labels, so the rule gives
 * way to the number.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Bars } from './index'
import { backingMarks, isStruck } from './core/label-backing'

const INK = { light: '#9a9a9a', dark: '#7d7d7d' }
const rule = { left: 0, top: 40, width: 200, height: 4 }

describe('isStruck', () => {
  const frame = { width: 200, height: 100 }
  const label = { left: 20, top: 30, width: 20, height: 14 }
  test('a box over a rule spanning the plot is struck, one beside it is not', () => {
    expect(isStruck(label, [rule], frame)).toBe(true)
    expect(isStruck({ ...label, top: 60 }, [rule], frame)).toBe(false)
    const vertical = { left: 28, top: 0, width: 4, height: 100 }
    expect(isStruck(label, [vertical], frame)).toBe(true)
  })

  test('a thin bar, a dot, a label or a line piece is not a rule', () => {
    const bar = { left: 24, top: 20, width: 8, height: 60 }
    const dot = { left: 24, top: 32, width: 6, height: 6 }
    const caption = { left: 0, top: 0, width: 80, height: 14 }
    const piece = { left: 24, top: 30, width: 5, height: 6 }
    for (const other of [bar, dot, caption, piece])
      expect(isStruck(label, [other], frame)).toBe(false)
  })
})

describe('backingMarks', () => {
  test('draws one mark for struck boxes and none for none', () => {
    const frame = { width: 300, height: 100 }
    const at = (boxes: (typeof rule)[]) =>
      backingMarks({ id: 'b', boxes, frame, domain: [0, 10], scale: 'y' })
    expect(at([])).toHaveLength(0)
    expect(at([rule])).toHaveLength(1)
  })
})

describe('a zero value a rule runs through', () => {
  test('is written on a card-colored backing', () => {
    const html = renderToString(
      <Bars<{ k: string; a: number }>
        label="V"
        height={100}
        data={[
          { k: 'a', a: 3 },
          { k: 'b', a: 0 },
          { k: 'c', a: 4 },
        ]}
        x={{ value: (d) => d.k }}
        layout="grouped"
        refLines={[{ value: 0.7, color: INK, dashed: true }]}
        series={[
          {
            mark: 'bar',
            key: 'a',
            label: 'A',
            color: INK,
            y: (d) => d.a,
            values: true,
            highlight: (d) => d.k === 'b',
          },
        ]}
      />,
    )
    expect(html).toContain('data-ts-key="bar-values-y-backing')
  })
})

describe('a chart with a vertical rule', () => {
  test('draws the rule before the value labels, so a label covers it', () => {
    const html = renderToString(
      <Bars<{ k: string; a: number }>
        label="V"
        height={100}
        data={[
          { k: 'a', a: 3 },
          { k: 'b', a: 4 },
        ]}
        x={{ value: (d) => d.k }}
        layout="grouped"
        refLines={[{ value: 'b', axis: 'x', color: INK }]}
        series={[{ mark: 'bar', key: 'a', label: 'A', color: INK, y: (d) => d.a, values: true }]}
      />,
    )
    expect(html.indexOf('data-ts-key="xref-0"')).toBeGreaterThan(-1)
    expect(html.indexOf('data-ts-key="xref-0"')).toBeLessThan(
      html.indexOf('data-ts-key="bar-values-y"'),
    )
  })
})
