import { describe, expect, test } from 'bun:test'
import { deriveLegend, deriveTooltipRows } from './series'
import type { SeriesStyle } from './series'

const baseSeries: SeriesStyle = {
  key: 'low-cloud',
  label: 'Low cloud',
  color: '#000',
  mark: 'line',
}

describe('deriveLegend note passthrough', () => {
  test('carries note through when set', () => {
    const [entry] = deriveLegend([{ ...baseSeries, note: '0% all night' }])
    expect(entry?.note).toBe('0% all night')
  })

  test('omits the note key entirely when unset', () => {
    const [entry] = deriveLegend([baseSeries])
    expect(entry).not.toHaveProperty('note')
  })
})

describe('deriveTooltipRows', () => {
  type Row = { v: number }
  const base = { color: '#000', mark: 'bar' as const, getValue: (d: Row) => d.v }
  const fmt = (v: number) => String(v)

  test('a `tooltip: false` series is drawn and legended but produces no row', () => {
    const rows = deriveTooltipRows(
      [
        { ...base, key: 'shown', label: 'Shown' },
        { ...base, key: 'quiet', label: 'Quiet', tooltip: false },
      ],
      { v: 1 },
      fmt,
    )
    expect(rows.map((r) => r.key)).toEqual(['shown'])
    expect(deriveLegend([{ ...base, key: 'quiet', label: 'Quiet', tooltip: false }])).toHaveLength(
      1,
    )
  })

  test('a null value still skips its row', () => {
    const rows = deriveTooltipRows(
      [{ ...base, key: 'gap', label: 'Gap', getValue: () => null }],
      { v: 1 },
      fmt,
    )
    expect(rows).toHaveLength(0)
  })

  test('a per-series formatValue wins over the shared fallback', () => {
    const rows = deriveTooltipRows(
      [{ ...base, key: 'a', label: 'A', formatValue: (v) => `${v}%` }],
      { v: 42 },
      fmt,
    )
    expect(rows[0]?.value).toBe('42%')
  })
})
