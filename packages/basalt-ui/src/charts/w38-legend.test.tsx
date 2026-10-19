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

describe('an explicit legend: false stays absolute', () => {
  test('two series: no legend at any width', () => {
    expect(
      legendOf(<Lines ariaLabel="L" data={data} x={x} series={[A, B]} legend={false} />),
    ).toBeNull()
  })
  test('named zones: no legend', () => {
    expect(
      legendOf(<Lines ariaLabel="L" data={data} x={x} series={[A]} zones={zones} legend={false} />),
    ).toBeNull()
  })
  test("naming 'endLabels' has no legend", () => {
    expect(
      legendOf(<Lines ariaLabel="L" data={data} x={x} series={[A, B]} naming="endLabels" />),
    ).toBeNull()
  })
})

describe('the compact legend names every entry', () => {
  test('every entry is in the markup, series first, and nothing can fold into +N', () => {
    const el = legendOf(<Lines ariaLabel="L" data={data} x={x} series={[A]} zones={zones} />)
    const roles = [...(el?.querySelectorAll('[data-legend-key]') ?? [])].map(
      (e) => (e as HTMLElement).dataset['legendRole'],
    )
    expect(roles).toEqual(['series', 'reference', 'reference'])
    expect(el?.querySelector('[data-legend-more]')).toBeNull()
  })
  test('3 series + 3 zone keys + 2 references render all 8 names', () => {
    const series = ['a', 'b', 'c'].map((k, i) => ({ ...A, key: k, label: `S${i}` }))
    const zs = [0, 1, 2].map((i) => ({
      from: i,
      to: i + 1,
      fill: VX.good,
      legend: { label: `Zone ${i}` },
    }))
    const refLines = [1, 2].map((v) => ({
      value: v,
      color: VX.faint,
      legend: { label: `Ref ${v}` },
    }))
    const el = legendOf(
      <Lines ariaLabel="L" data={data} x={x} series={series} zones={zs} refLines={refLines} />,
    )
    expect(keys(el)).toEqual(['S0', 'S1', 'S2', 'Ref 1', 'Ref 2', 'Zone 0', 'Zone 1', 'Zone 2'])
  })
})
