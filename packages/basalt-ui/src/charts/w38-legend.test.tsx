/**
 * Wave 38, narrow legends: a zone names itself in the legend (`ZoneSpec.legend`), and a chart that
 * passes `legend: false` still keeps its key below the 480px container when two or more entries
 * need telling apart. A single entry, or end labels naming the lines, may drop it.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { VX } from '../tokens'
import { Lines } from './Lines'
import { zoneLegendSeries } from './compile'
import type { ChartSeries } from './types'

type Row = { t: Date; a: number; b: number }
const A: ChartSeries<Row> = { key: 'a', label: 'Alpha', color: VX.line, getValue: (d) => d.a }
const B: ChartSeries<Row> = { key: 'b', label: 'Beta', color: VX.line2, getValue: (d) => d.b }
const data: Row[] = [1, 2, 3, 4].map((d) => ({ t: new Date(Date.UTC(2026, 9, d)), a: d, b: d * 2 }))
const x = (d: Row): Date => d.t
const zones = [
  { from: 0, to: 2, fill: VX.good, legend: { label: 'Good', color: VX.goodSolid } },
  { from: 2, to: 4, fill: VX.bad, legend: { label: 'Bad' } },
]

const legendOf = (node: React.ReactNode): HTMLElement | null => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(node)
  return el.querySelector<HTMLElement>('[data-basalt-chart-legend]')
}
const keys = (el: HTMLElement | null): string[] =>
  [...(el?.querySelectorAll('[data-legend-key]') ?? [])].map((e) => e.textContent ?? '')

describe('a zone names itself in the legend', () => {
  test('entries follow the series, zone order, with the swatch colour', () => {
    expect(zoneLegendSeries(zones).map((s) => [s.label, s.color, s.mark])).toEqual([
      ['Good', VX.goodSolid, 'bar'],
      ['Bad', VX.badSolid, 'bar'],
    ])
    expect(zoneLegendSeries(undefined)).toEqual([])
  })
  test('one series + named zones show a legend by default', () => {
    const el = legendOf(<Lines ariaLabel="L" data={data} x={x} series={[A]} zones={zones} />)
    expect(keys(el)).toEqual(['Alpha', 'Good', 'Bad'])
  })
  test('unnamed zones add nothing; one series keeps no legend', () => {
    const bare = zones.map(({ from, to, fill }) => ({ from, to, fill }))
    expect(legendOf(<Lines ariaLabel="L" data={data} x={x} series={[A]} zones={bare} />)).toBeNull()
  })
})

describe('legend: false keeps the key below 480px', () => {
  test('two series: the key renders, compact-only', () => {
    const el = legendOf(<Lines ariaLabel="L" data={data} x={x} series={[A, B]} legend={false} />)
    expect(keys(el)).toEqual(['Alpha', 'Beta'])
    expect(el?.hasAttribute('data-compact-only')).toBe(true)
  })
  test('one series with named zones: the zone key renders, compact-only', () => {
    const el = legendOf(
      <Lines ariaLabel="L" data={data} x={x} series={[A]} zones={zones} legend={false} />,
    )
    expect(keys(el)).toEqual(['Alpha', 'Good', 'Bad'])
    expect(el?.hasAttribute('data-compact-only')).toBe(true)
  })
  test('a single entry drops it', () => {
    expect(
      legendOf(<Lines ariaLabel="L" data={data} x={x} series={[A]} legend={false} />),
    ).toBeNull()
  })
  test("naming 'endLabels' drops it at every width", () => {
    expect(
      legendOf(
        <Lines ariaLabel="L" data={data} x={x} series={[A, B]} naming="endLabels" legend={false} />,
      ),
    ).toBeNull()
  })
})
