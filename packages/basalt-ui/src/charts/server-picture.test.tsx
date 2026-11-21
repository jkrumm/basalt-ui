/**
 * The server picture (Astro matrix, `docs/v3/verdicts/astro-matrix.md`): the svg a page renders before
 * hydration is drawn at the box's own size, for the frame the server assumes, so a static page shows the
 * chart the browser draws. The box height comes from the same rule the stylesheet applies.
 */
import { describe, expect, spyOn, test } from 'bun:test'
import type { ChartTextMeasureOptions } from '@tanstack/charts/types/core'
import { renderToString } from 'react-dom/server'
import { boxHeightAt } from './box'
import { chartLabels } from './chart-labels'
import type { SeriesColor } from './contract'
import { BOX, ChartCard, SERVER_FRAME } from './parts/chart-card'
import { SURFACE } from './parts/chart-card-frame'
import { INITIAL_WIDTH } from './sizing'
import * as textMeasure from './text-measure'
import { Lines } from './parts/lines'
import type { LineSeries } from './parts/lines'
import { measureChartText } from './text-measure'

type Row = { t: Date; v: number }
const data: Row[] = [1, 2, 3, 4].map((d) => ({ t: new Date(Date.UTC(2026, 8, d)), v: d * 10 }))
const color: SeriesColor = { light: 'var(--basalt-line)', dark: 'var(--basalt-line)' }
const series: LineSeries<Row>[] = [{ mark: 'line', key: 'v', label: 'V', color, y: (d) => d.v }]
const x = { value: (d: Row): Date => d.t }

const viewBox = (html: string): string | undefined =>
  /<svg class="ts-chart"[^>]*viewBox="([^"]+)"/.exec(html)?.[1]

describe('boxHeightAt', () => {
  test('a number is the box at every width', () => {
    expect(boxHeightAt(220, 640)).toBe(220)
    expect(boxHeightAt(220, 300)).toBe(220)
  })
  test('the law is the class ratio of the width, clamped', () => {
    expect(boxHeightAt(undefined, 640)).toBe(320)
    expect(boxHeightAt(undefined, 1200)).toBe(420)
    expect(boxHeightAt(undefined, 200)).toBe(160)
  })
  test('a responsive height picks the class the width falls in', () => {
    const height = { base: 180, regular: 240, wide: 300 }
    expect(boxHeightAt(height, 300)).toBe(180)
    expect(boxHeightAt(height, 640)).toBe(240)
    expect(boxHeightAt(height, 900)).toBe(300)
  })
  test('a fill box is its parent, unknown to the box', () => {
    expect(boxHeightAt('fill', 640)).toBeUndefined()
  })
})

describe('the server svg is drawn at the box', () => {
  test('a stated height', () => {
    const html = renderToString(<Lines label="L" data={data} x={x} height={220} series={series} />)
    expect(viewBox(html)).toBe('0 0 640 220')
  })
  test('the height law at the server width', () => {
    const html = renderToString(<Lines label="L" data={data} x={x} series={series} />)
    expect(viewBox(html)).toBe('0 0 640 320')
  })
  test("in a ChartCard: the card's box, its edges off the width", () => {
    const chart = (box: { height: 'fill' | number }) => (
      <Lines label="L" data={data} x={x} height={box.height} series={series} />
    )
    expect(viewBox(renderToString(<ChartCard title="T" chart={chart} />))).toBe('0 0 608 320')
    expect(viewBox(renderToString(<ChartCard title="T" height="short" chart={chart} />))).toBe(
      '0 0 608 160',
    )
  })
})

describe("a ChartCard's server frame is its box's classes", () => {
  const REM = 16
  test("the edge is the card surface's --card-edge", () => {
    const edge = /\[--card-edge:([\d.]+)rem\]/.exec(SURFACE)?.[1]
    expect(SERVER_FRAME.auto.width).toBe(INITIAL_WIDTH - 2 * Number(edge) * REM)
  })
  test('each box height is its class at a card INITIAL_WIDTH wide', () => {
    for (const key of ['auto', 'tall', 'short'] as const) {
      const clamp = /h-\[clamp\(([\d.]+)rem,(\d+)cqw,([\d.]+)rem\)\]/.exec(BOX[key])
      const fixed = /\bh-(\d+)\b/.exec(BOX[key])
      const height = clamp
        ? Math.min(
            Number(clamp[3]) * REM,
            Math.max(Number(clamp[1]) * REM, (Number(clamp[2]) / 100) * INITIAL_WIDTH),
          )
        : Number(fixed?.[1]) * 4
      expect(SERVER_FRAME[key].height).toBe(height)
    }
  })
  test('panes split the box by weight above a 160 px floor, 4 px apart', () => {
    const pane = (box: { height: 'fill' | number }) => (
      <Lines label="P" data={data} x={x} height={box.height} series={series} />
    )
    const html = renderToString(
      <ChartCard
        title="T"
        panes={[
          { weight: 3, chart: pane },
          { weight: 1, chart: pane },
        ]}
      />,
    )
    const boxes = [...html.matchAll(/<svg class="ts-chart"[^>]*viewBox="([^"]+)"/g)].map(
      (m) => m[1],
    )
    // 3:1 of the 320 px box would leave the second pane 79 px: it is held at 160, the first takes the rest.
    expect(boxes).toEqual(['0 0 608 160', '0 0 608 160'])
  })
})

describe('the engine measures text with the label table', () => {
  test('a server render reads measureChartText', () => {
    const spy = spyOn(textMeasure, 'measureChartText')
    renderToString(<Lines label="L" data={data} x={x} height={220} series={series} />)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('measureChartText', () => {
  const options = (o: Partial<ChartTextMeasureOptions>): ChartTextMeasureOptions => ({
    fontSize: 11,
    fontFamily: 'sans-serif',
    fontStyle: 'normal',
    fontStretch: 'normal',
    letterSpacing: 0,
    direction: 'ltr',
    fontScale: 1,
    anchor: 'start',
    baseline: 'auto',
    ...o,
  })
  test('the width is the label table, the same on the server and in the browser', () => {
    const m = measureChartText('1,250', options({}))
    expect(m.width).toBeCloseTo(chartLabels.width('1,250', { size: 11 }), 6)
    // Centred text keeps a per-glyph room between glyphs (text-measure.ts GLYPH_ROOM).
    const centred = measureChartText('1,250', options({ anchor: 'middle' }))
    expect(centred.width).toBeCloseTo(m.width + 4 * 0.03 * 11, 6)
  })
  test('the anchor places the box', () => {
    const w = measureChartText('Oct 4', options({ anchor: 'middle' })).width
    expect(measureChartText('Oct 4', options({ anchor: 'middle' })).x).toBeCloseTo(-w / 2, 6)
    expect(measureChartText('Oct 4', options({ anchor: 'end' })).x).toBeCloseTo(
      -measureChartText('Oct 4', options({})).width,
      6,
    )
  })
  test('empty text measures nothing', () => {
    expect(measureChartText('', options({}))).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})
