/**
 * Expression cycle 19 (`v3-expr-19-contract`, n93 and n97): a `y.domain` function on stacked bars reads
 * the stack totals' extent, a clamped stack's caret label is the total in the value ink, and a series
 * with `valuesAt: 'segment'` labels its own segment inside it rather than the stack total.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Bars, CartesianChart } from './index'
import type { Series } from './contract'
import { leftExtent } from './seams/y-domain'

type Day = { k: string; vig: number; mod: number }
const INK = { light: '#2a2a2a', dark: '#e0e0e0' }
const PALE = { light: '#c4c4c4', dark: '#5a5a5a' }

/** Fourteen days, each stack under 70, one day (index 6) at 238 + 31. */
const days = (peak: boolean): Day[] =>
  Array.from({ length: 14 }, (_, i) => ({
    k: 'd' + String(i).padStart(2, '0'),
    vig: peak && i === 6 ? 238 : 10 + (i % 5) * 3,
    mod: peak && i === 6 ? 31 : 30 + (i % 4) * 5,
  }))

const minutes = (opts: { segment?: boolean } = {}): Series<Day>[] => [
  {
    mark: 'bar',
    key: 'vig',
    label: 'Vigorous',
    color: INK,
    y: (d) => d.vig,
    ...(opts.segment === true && { values: true, valuesAt: 'segment' as const }),
  },
  { mark: 'bar', key: 'mod', label: 'Moderate', color: PALE, y: (d) => d.mod },
]

/** The text marks whose key starts with `key`, with their text and fill. */
const texts = (html: string, key: string): { text: string; fill: string }[] =>
  [
    ...html.matchAll(
      new RegExp(`<text data-ts-key="${key}[^"]*"[^>]*?fill="([^"]*)"[^>]*>([^<]*)</text>`, 'g'),
    ),
  ].map((m) => ({ fill: m[1] ?? '', text: m[2] ?? '' }))

const cap = ([lo, hi]: readonly [number, number]): [number, number] => [lo, Math.min(hi, 100)]

describe('a y.domain function on stacked bars', () => {
  test('reads the stack totals, not one series', () => {
    expect(leftExtent({ data: days(true), series: minutes() })).toEqual([0, 269])
    expect(leftExtent({ data: days(true), series: minutes(), layout: 'grouped' })).toEqual([
      10, 238,
    ])
  })

  test('a fortnight under the cap draws no caret', () => {
    const html = renderToString(
      <CartesianChart<Day>
        label="Minutes"
        data={days(false)}
        x={{ value: (d) => d.k }}
        y={{ domain: cap }}
        series={minutes()}
      />,
    )
    expect(texts(html, 'stack-cap-top')).toHaveLength(0)
  })

  test('only the day past the cap draws one, its label the total in the value ink', () => {
    const html = renderToString(
      <CartesianChart<Day>
        label="Minutes"
        data={days(true)}
        x={{ value: (d) => d.k }}
        y={{ domain: cap }}
        series={minutes()}
      />,
    )
    expect(texts(html, 'stack-cap-top')).toHaveLength(1)
    expect(texts(html, 'stack-cap-value')).toEqual([
      { text: '269', fill: 'var(--basalt-ink-muted)' },
    ])
  })
})

describe('valuesAt: segment', () => {
  test('labels the series inside its own segment, and writes no stack total', () => {
    const html = renderToString(
      <CartesianChart<Day>
        label="Minutes"
        data={days(false)}
        x={{ value: (d) => d.k }}
        series={minutes({ segment: true })}
      />,
    )
    const segs = texts(html, 'bar-segment-values')
    expect(segs.length).toBeGreaterThan(0)
    for (const s of segs) expect(['10', '13', '16', '19', '22']).toContain(s.text)
    expect(texts(html, 'bar-values')).toHaveLength(0)
  })

  test('on a clamped stack, the segment keeps its true value and the caret keeps the total', () => {
    const html = renderToString(
      <CartesianChart<Day>
        label="Minutes"
        data={days(true)}
        x={{ value: (d) => d.k }}
        y={{ domain: cap }}
        series={minutes({ segment: true })}
      />,
    )
    expect(texts(html, 'bar-segment-values').map((s) => s.text)).toContain('238')
    expect(texts(html, 'stack-cap-value').map((s) => s.text)).toEqual(['269'])
  })

  test('a stack can carry a total and a segment label at once', () => {
    const html = renderToString(
      <Bars<Day>
        label="Minutes"
        data={days(false)}
        x={{ value: (d) => d.k }}
        series={[
          { ...minutes({ segment: true })[0]! },
          {
            mark: 'bar',
            key: 'mod',
            label: 'Moderate',
            color: PALE,
            y: (d) => d.mod,
            values: true,
          },
        ]}
      />,
    )
    expect(texts(html, 'bar-segment-values').length).toBeGreaterThan(0)
    expect(texts(html, 'bar-values').length).toBeGreaterThan(0)
  })

  test('on grouped bars labels the end, as values does', () => {
    const html = renderToString(
      <Bars<Day>
        label="Minutes"
        layout="grouped"
        data={days(false)}
        x={{ value: (d) => d.k }}
        series={minutes({ segment: true })}
      />,
    )
    expect(texts(html, 'bar-segment-values')).toHaveLength(0)
    expect(texts(html, 'bar-values').length).toBeGreaterThan(0)
  })
})
