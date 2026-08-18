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

  test('formatValue receives the hovered datum alongside the value', () => {
    type Set = { v: number; reps: number }
    const rows = deriveTooltipRows(
      [
        {
          key: 'set',
          label: 'Set',
          color: '#000',
          mark: 'bar' as const,
          getValue: (d: Set) => d.v,
          formatValue: (v: number, d: Set) => `${v} kg (${d.reps} reps)`,
        },
      ],
      { v: 97.5, reps: 3 },
      fmt,
    )
    expect(rows[0]?.value).toBe('97.5 kg (3 reps)')
  })

  test('the fallback formatter (single-arg) still works once formatValue is 2-arg typed', () => {
    const rows = deriveTooltipRows([{ ...base, key: 'a', label: 'A' }], { v: 5 }, fmt)
    expect(rows[0]?.value).toBe('5')
  })
})

describe('strokeOpacity — a mark property, not a tooltip property', () => {
  test('reaches the derived legend entry', () => {
    const [entry] = deriveLegend([{ ...baseSeries, strokeOpacity: 0.4 }])
    expect(entry?.strokeOpacity).toBe(0.4)
  })

  test('is absent from the legend entry when unset', () => {
    const [entry] = deriveLegend([baseSeries])
    expect(entry).not.toHaveProperty('strokeOpacity')
  })

  test('never reaches TooltipRowData — the row is a 12px value chip, not a dimmed mark', () => {
    const rows = deriveTooltipRows(
      [
        {
          ...baseSeries,
          strokeOpacity: 0.4,
          getValue: () => 10,
        },
      ],
      {},
      (v) => String(v),
    )
    expect(rows[0]).not.toHaveProperty('strokeOpacity')
  })
})
