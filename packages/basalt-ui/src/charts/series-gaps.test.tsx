/**
 * `ChartSeries.gaps`: a wide table where each lift is null on alternating dates draws broken
 * segments by default and one continuous path per series with `'connect'`.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { Lines } from './Lines'
import type { ChartSeries } from './types'

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
})
