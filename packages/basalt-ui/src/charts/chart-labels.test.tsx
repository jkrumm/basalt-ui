/**
 * `chartLabels`: the width table is deterministic and DOM-free, `fits` has a hard boundary, and
 * `place` resolves contested spots by priority. A server render and a client render of placed
 * labels agree on every box.
 */
import { afterEach, describe, expect, test } from 'bun:test'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { chartLabels } from './chart-labels'
import type { ChartLabel } from './chart-labels'

const FRAME = { width: 200, height: 100 }
const label = (key: string, over: Partial<ChartLabel<string>> = {}): ChartLabel<string> => ({
  key,
  text: 'Label',
  x: 100,
  y: 50,
  size: 10,
  ...over,
})

describe('width', () => {
  test('is deterministic and scales linearly with size', () => {
    const a = chartLabels.width('Revenue', { size: 10 })
    expect(chartLabels.width('Revenue', { size: 10 })).toBe(a)
    expect(chartLabels.width('Revenue', { size: 20 })).toBeCloseTo(a * 2, 9)
    expect(a).toBeGreaterThan(0)
  })
  test('needs no DOM or canvas', () => {
    const doc = globalThis.document
    // @ts-expect-error -- removing the global proves the module never reads it
    delete globalThis.document
    try {
      expect(chartLabels.width('Price 12.5%')).toBeGreaterThan(0)
    } finally {
      globalThis.document = doc
    }
  })
  test('tabular digits are one width', () => {
    const widths = [...'0123456789'].map((d) => chartLabels.width(d, { size: 20 }))
    expect(new Set(widths).size).toBe(1)
  })
  test('a wider weight is never narrower', () => {
    const text = 'Quality of service'
    const w = ([400, 500, 600, 700] as const).map((weight) => chartLabels.width(text, { weight }))
    for (let i = 1; i < w.length; i++) expect(w[i] ?? 0).toBeGreaterThanOrEqual(w[i - 1] ?? 0)
  })
  test('an unknown glyph counts as a mean-width glyph, not zero', () => {
    expect(chartLabels.width('中')).toBeGreaterThan(0)
  })
})

describe('fits', () => {
  const w = chartLabels.width('Segment', { size: 11 })
  test('is true at the boundary and false just under it', () => {
    expect(chartLabels.fits('Segment', { width: w }, { size: 11 })).toBe(true)
    expect(chartLabels.fits('Segment', { width: w - 0.01 }, { size: 11 })).toBe(false)
  })
  test('pad is kept free on both sides', () => {
    expect(chartLabels.fits('Segment', { width: w + 4 }, { size: 11, pad: 2 })).toBe(true)
    expect(chartLabels.fits('Segment', { width: w + 3.99 }, { size: 11, pad: 2 })).toBe(false)
  })
  test('height is checked when given', () => {
    expect(chartLabels.fits('Segment', { width: w, height: 5 }, { size: 11 })).toBe(false)
    expect(chartLabels.fits('Segment', { width: w, height: 40 }, { size: 11 })).toBe(true)
  })
})

describe('place', () => {
  test('lands on the first spot, with the anchor geometry a caller draws from', () => {
    const { placed, dropped } = chartLabels.place([label('a')], FRAME)
    const first = placed[0]
    expect(dropped).toEqual([])
    expect(first?.spot).toBe('right')
    expect(first?.left).toBe(104)
    expect(first?.textAnchor).toBe('start')
    expect(first?.textX).toBe(104)
    expect(first?.height).toBeCloseTo(12, 9)
  })
  test('the higher priority wins a contested spot; ties keep input order', () => {
    const low = label('low', { spots: ['right'] })
    const high = label('high', { spots: ['right'], priority: 5 })
    const { placed, dropped } = chartLabels.place([low, high], FRAME)
    expect(placed.map((p) => p.key)).toEqual(['high'])
    expect(dropped.map((d) => d.key)).toEqual(['low'])
    const tie = chartLabels.place(
      [label('first', { spots: ['right'] }), label('second', { spots: ['right'] })],
      FRAME,
    )
    expect(tie.placed.map((p) => p.key)).toEqual(['first'])
  })
  test('a label whose spots all collide or leave the frame is dropped', () => {
    const corner = label('corner', {
      x: 0,
      y: 0,
      spots: ['left', 'above', 'above-left', 'above-right'],
    })
    expect(chartLabels.place([corner], FRAME).dropped.map((d) => d.key)).toEqual(['corner'])
    const blocked = chartLabels.place([label('b')], FRAME, {
      obstacles: [{ left: 0, top: 0, width: 200, height: 100 }],
    })
    expect(blocked.placed).toEqual([])
    expect(blocked.dropped).toHaveLength(1)
  })
  test('an obstacle is avoided by moving to the next spot', () => {
    const { placed } = chartLabels.place([label('a')], FRAME, {
      obstacles: [{ left: 104, top: 44, width: 40, height: 12 }],
    })
    expect(placed[0]?.spot).toBe('left')
  })
  test('a restricted spots list is honoured', () => {
    const { placed } = chartLabels.place([label('a', { spots: ['below', 'above'] })], FRAME)
    expect(placed[0]?.spot).toBe('below')
    expect(placed[0]?.textAnchor).toBe('middle')
  })
  test('placed labels never overlap each other', () => {
    const many = Array.from({ length: 6 }, (_, i) => label(`k${i}`, { x: 100 + i, y: 50 }))
    const { placed } = chartLabels.place(many, FRAME)
    for (const [i, a] of placed.entries())
      for (const b of placed.slice(i + 1))
        expect(
          a.left < b.left + b.width &&
            b.left < a.left + a.width &&
            a.top < b.top + b.height &&
            b.top < a.top + a.height,
        ).toBe(false)
  })
})

const read = (root: ParentNode) =>
  [...root.querySelectorAll('span')].map((s) => [
    s.getAttribute('data-key'),
    s.style.left,
    s.style.top,
    s.style.width,
  ])

describe('server and client agree', () => {
  const labels = [
    label('a', { text: 'Alpha 12.5%', x: 40, y: 30, priority: 2 }),
    label('b', { text: 'Beta', x: 44, y: 32 }),
    label('c', { text: 'Gamma', x: 190, y: 90, weight: 700 }),
  ]
  function Labels() {
    const { placed } = chartLabels.place(labels, FRAME)
    return (
      <div>
        {placed.map((p) => (
          <span
            key={p.key}
            data-key={p.key}
            style={{ position: 'absolute', left: p.left, top: p.top, width: p.width }}
          >
            {p.text}
          </span>
        ))}
      </div>
    )
  }
  let root: ReturnType<typeof createRoot> | undefined
  afterEach(() => {
    act(() => root?.unmount())
    root = undefined
    document.body.innerHTML = ''
  })

  test('renderToString and createRoot produce the same left, top and width', async () => {
    const server = document.createElement('div')
    server.innerHTML = renderToString(<Labels />)
    const el = document.createElement('div')
    document.body.append(el)
    root = createRoot(el)
    await act(async () => {
      root?.render(<Labels />)
    })
    expect(read(server).length).toBe(3)
    expect(read(el)).toEqual(read(server))
  })
})
