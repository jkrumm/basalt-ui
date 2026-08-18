/**
 * `MultiLine` — the `strokeOpacity` wiring: `dimOpacity(s) * (s.strokeOpacity ?? 1)`. SSR harness
 * (no hover needed), same pattern as `CartesianChart.test.tsx`'s `nice` assertions.
 */
import { describe, expect, test } from 'bun:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { MultiLine } from './MultiLine'
import type { ChartSeries } from '../series'

type Row = { date: string; v: number }

const rows: Row[] = [
  { date: '2026-08-01', v: 10 },
  { date: '2026-08-02', v: 12 },
]

describe('MultiLine — series.strokeOpacity dims the plotted stroke', () => {
  test('the line path carries the configured stroke-opacity attribute', () => {
    const series: ChartSeries<Row>[] = [
      {
        key: 'v',
        label: 'V',
        color: '#123456',
        mark: 'line',
        getValue: (d) => d.v,
        strokeOpacity: 0.35,
      },
    ]

    const html = renderToStaticMarkup(
      <MultiLine<Row> data={rows} chartId="ml-opacity" getX={(d) => d.date} series={series} />,
    )

    expect(html).toContain('stroke="#123456"')
    expect(html).toContain('stroke-opacity="0.35"')
  })
})
