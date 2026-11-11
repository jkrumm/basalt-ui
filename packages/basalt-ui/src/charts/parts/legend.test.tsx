/**
 * The v3 legend: entries as data, in the server HTML, a failed entry reading `charts.unavailable`
 * (one string, overridable through the provider's messages), and a failed series through
 * `CartesianChart` drawing nothing while the phase stays ready.
 */
import { describe, expect, test } from 'bun:test'
import { renderToString } from 'react-dom/server'
import { IntlScope } from '../../core/provider-props'
import type { LegendEntry, Series, SeriesColor } from '../contract'
import { CartesianChart } from './cartesian'
import { Legend } from './legend'

const pair = (v: string): SeriesColor => ({ light: `var(--vx-${v})`, dark: `var(--vx-${v})` })
const html = (node: React.ReactNode): HTMLElement => {
  const el = document.createElement('div')
  el.innerHTML = renderToString(node)
  return el
}
const names = (el: HTMLElement): string[] =>
  [...el.querySelectorAll('[data-legend-key]')].map((e) => e.textContent ?? '')

const entries: LegendEntry[] = [
  { key: 'a', label: 'Alpha', color: pair('line') },
  { key: 'b', label: 'Beta', color: pair('line2'), swatch: 'dashed', failed: true },
]

describe('Legend', () => {
  test('entries are in the server HTML, with both swatch modes for CSS to pick', () => {
    const el = html(<Legend entries={entries} />)
    expect(names(el)).toEqual(['Alpha', 'Betaunavailable'])
    expect(el.querySelector('[data-basalt-chart-legend="auto"]')).not.toBeNull()
    expect(el.querySelectorAll('[data-legend-key="a"] svg').length).toBe(2)
  })

  test('a failed entry reads unavailable, a healthy one reads nothing extra', () => {
    const el = html(<Legend entries={entries} />)
    expect(el.querySelector('[data-legend-key="b"]')?.textContent).toContain('unavailable')
    expect(el.querySelector('[data-legend-key="a"]')?.textContent).toBe('Alpha')
  })

  test('the string is the provider message `charts.unavailable`', () => {
    const el = html(
      <IntlScope messages={{ 'charts.unavailable': 'nicht verfügbar' }}>
        <Legend entries={entries} />
      </IntlScope>,
    )
    expect(el.querySelector('[data-legend-key="b"]')?.textContent).toContain('nicht verfügbar')
  })

  test('a dashed entry keeps its dash in the key', () => {
    const el = html(<Legend entries={entries} />)
    expect(el.querySelector('[data-legend-key="b"] line')?.getAttribute('stroke-dasharray')).toBe(
      '4 3',
    )
    expect(
      el.querySelector('[data-legend-key="a"] line')?.getAttribute('stroke-dasharray'),
    ).toBeNull()
  })

  test('with onToggle entries are buttons, without they are labels', () => {
    expect(
      html(<Legend entries={entries} onToggle={() => {}} />).querySelectorAll('button'),
    ).toHaveLength(2)
    expect(html(<Legend entries={entries} />).querySelectorAll('button')).toHaveLength(0)
  })

  test('concealed keeps the box and hides it from everyone', () => {
    const row = html(<Legend entries={entries} concealed />).querySelector('fieldset')
    expect(row?.getAttribute('aria-hidden')).toBe('true')
    expect(row?.style.visibility).toBe('hidden')
  })

  test('no entries, no legend', () => {
    expect(html(<Legend entries={[]} />).querySelector('fieldset')).toBeNull()
  })
})

describe('a failed series in CartesianChart', () => {
  type Row = { t: number; a: number; b: number }
  const rows: Row[] = Array.from({ length: 6 }, (_, i) => ({
    t: Date.UTC(2026, 8, 1 + i),
    a: i + 1,
    b: (i + 1) * 2,
  }))
  const x = { value: (d: Row): Date => new Date(d.t) }
  const a: Series<Row> = {
    mark: 'line',
    key: 'a',
    label: 'Alpha',
    color: pair('line'),
    y: (d) => d.a,
  }
  const b: Series<Row> = {
    mark: 'line',
    key: 'b',
    label: 'Beta',
    color: pair('line2'),
    y: (d) => d.b,
  }
  const chart = (failed: boolean): HTMLElement =>
    html(
      <CartesianChart
        ariaLabel="Both"
        data={rows}
        x={x}
        series={[a, { ...b, ...(failed && { failed }) }]}
      />,
    )

  test('the legend is in the server HTML and reads unavailable for the failed series', () => {
    const el = chart(true)
    expect(el.querySelector('[data-legend-key="b"]')?.textContent).toContain('unavailable')
    expect(el.querySelector('[data-legend-key="a"]')?.textContent).toBe('Alpha')
  })

  test('it draws nothing and the chart stays a ready chart, not a placeholder', () => {
    const ok = chart(false)
    const failed = chart(true)
    expect(ok.querySelector('[data-legend-key="b"]')?.textContent).toBe('Beta')
    expect(failed.querySelector('svg')).not.toBeNull()
    expect(failed.querySelector('[role="alert"], [data-basalt-chart-placeholder]')).toBeNull()
    expect(
      failed.querySelector('[data-basalt-chart-legend]')?.getAttribute('aria-hidden'),
    ).toBeNull()
  })

  test('every series failed still names them all', () => {
    const el = html(
      <CartesianChart
        ariaLabel="Both"
        data={rows}
        x={x}
        series={[
          { ...a, failed: true },
          { ...b, failed: true },
        ]}
      />,
    )
    expect(names(el)).toEqual(['Alphaunavailable', 'Betaunavailable'])
  })
})
