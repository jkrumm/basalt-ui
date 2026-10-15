/**
 * `ChartSeries.gaps`: a wide table where each lift is null on alternating dates draws broken
 * segments by default and one continuous path per series with `'connect'`.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Lines } from './Lines'
import { loneDots } from './marks'
import type { ChartSeries, PlotRow } from './types'

type Row = { t: Date; squat: number | null; bench: number | null }
const data: Row[] = Array.from({ length: 8 }, (_, i) => ({
  t: new Date(Date.UTC(2026, 8, i + 1)),
  squat: i % 2 === 0 ? 100 + i : null,
  bench: i % 2 === 1 ? 60 + i : null,
}))
const lift = (key: 'squat' | 'bench', gaps?: ChartSeries<Row>['gaps']): ChartSeries<Row> => ({
  key,
  label: key,
  color: `var(--vx-${key === 'squat' ? 'line' : 'accent'})`,
  getValue: (d) => d[key],
  ...(gaps !== undefined && { gaps }),
})

const html = (series: ChartSeries<Row>[]): string =>
  renderToString(<Lines ariaLabel="Lifts" data={data} x={(d) => d.t} series={series} />)

/** Subpaths (`M` commands) of every path in a series' line group. */
function segments(markup: string, key: string): number {
  const host = document.createElement('div')
  host.innerHTML = markup
  const paths = [...host.querySelectorAll(`g.ts-chart__line[data-ts-key^="${key}:"] path`)]
  return paths.reduce((n, p) => n + (p.getAttribute('d')?.match(/M/g)?.length ?? 0), 0)
}

describe('series gaps', () => {
  test("'connect' draws one continuous path per series", () => {
    const out = html([lift('squat', 'connect'), lift('bench', 'connect')])
    expect(segments(out, 'squat')).toBe(1)
    expect(segments(out, 'bench')).toBe(1)
  })

  test("the default, 'break' and undefined leave a gap at every null row", () => {
    const plain = html([lift('squat'), lift('bench')])
    expect(segments(plain, 'squat')).toBeGreaterThan(1)
    expect(segments(html([lift('squat', 'break'), lift('bench', undefined)]), 'bench')).toBe(
      segments(plain, 'bench'),
    )
  })

  test('the option is per series', () => {
    const out = html([lift('squat', 'connect'), lift('bench')])
    expect(segments(out, 'squat')).toBe(1)
    expect(segments(out, 'bench')).toBeGreaterThan(1)
  })

  test("the area follows the line: 'connect' fills one region", () => {
    const host = document.createElement('div')
    host.innerHTML = html([{ ...lift('squat', 'connect'), area: true }])
    expect(host.querySelectorAll('g[data-ts-key^="squat-area"] path').length).toBe(1)
  })

  test('markers land on real points only, and the render is deterministic', () => {
    const marked = (): string =>
      html([{ ...lift('squat', 'connect'), getMarker: () => ({}) }, lift('bench', 'connect')])
    const host = document.createElement('div')
    host.innerHTML = marked()
    expect(host.querySelectorAll('g[data-ts-key="squat-marker-0"] circle').length).toBe(4)
    expect(marked()).toBe(marked())
  })

  describe('a lone point (ledger row 107)', () => {
    const loneRows = (values: (number | null)[]): Row[] =>
      values.map((v, i) => ({ t: new Date(Date.UTC(2026, 8, i + 1)), squat: v, bench: null }))
    const render = (rows: Row[], extra: Partial<ChartSeries<Row>> = {}): Document => {
      const doc = document.implementation.createHTMLDocument('')
      doc.body.innerHTML = renderToString(
        <Lines
          ariaLabel="Lone"
          data={rows}
          x={(d) => d.t}
          series={[{ ...lift('squat'), ...extra }]}
        />,
      )
      return doc
    }
    const dots = (doc: Document): number =>
      doc.querySelectorAll('g[data-ts-key^="squat-lone"] circle').length

    test('a one-point series draws its dot', () => {
      expect(dots(render(loneRows([100])))).toBe(1)
    })

    test('a single finite value between nulls draws its dot', () => {
      expect(dots(render(loneRows([null, 100, null])))).toBe(1)
    })

    test('every isolated point between gaps draws a dot; a connected run draws none', () => {
      expect(dots(render(loneRows([100, null, 90, null, 80, 81, 82])))).toBe(2)
    })

    test("'connect' bridges the gaps, so only a series with one finite point is lone", () => {
      expect(dots(render(loneRows([100, null, 90]), { gaps: 'connect' }))).toBe(0)
      expect(dots(render(loneRows([null, 100, null]), { gaps: 'connect' }))).toBe(1)
    })

    test('getMarker returning null leaves the point to the lone dot; a marker colour takes it over', () => {
      expect(dots(render(loneRows([null, 100, null]), { getMarker: () => null }))).toBe(1)
      expect(
        dots(render(loneRows([null, 100, null]), { getMarker: () => ({ color: 'red' }) })),
      ).toBe(0)
    })

    describe('loneDots directly', () => {
      const row = (y: number | null, i: number): PlotRow<Row, Date> => ({
        x: new Date(Date.UTC(2026, 8, i + 1)),
        y,
        series: 'squat',
        datum: { t: new Date(), squat: y, bench: null },
      })
      const rowsOf = (ys: (number | null)[]): PlotRow<Row, Date>[] => ys.map(row)
      const s = lift('squat')

      test('a hidden series has no rows, so no dot', () => {
        expect(loneDots(s, [], undefined, null)).toEqual([])
      })

      test('a highlighted other entry still draws the dot (dimmed), a highlighted own entry too', () => {
        const ys = rowsOf([null, 5, null])
        expect(loneDots(s, ys, undefined, 'bench')).toHaveLength(1)
        expect(loneDots(s, ys, undefined, 'squat')).toHaveLength(1)
      })

      test('NaN and Infinity are not finite points: no dot for them, none made lone by them', () => {
        expect(
          loneDots(s, rowsOf([Number.NaN, Number.POSITIVE_INFINITY]), undefined, null),
        ).toEqual([])
        // 5 sits between two non-finite rows, so it is lone; the non-finite ones are not.
        const mark = loneDots(s, rowsOf([Number.NaN, 5, Number.POSITIVE_INFINITY]), undefined, null)
        expect(mark).toHaveLength(1)
      })

      test('one mark per series, however many lone points', () => {
        expect(loneDots(s, rowsOf([1, null, 2, null, 3]), undefined, null)).toHaveLength(1)
      })
    })

    test('a point the consumer already marks is not doubled', () => {
      expect(dots(render(loneRows([null, 100, null]), { getMarker: () => ({}) }))).toBe(0)
    })
  })
})
