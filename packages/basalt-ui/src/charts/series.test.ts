import { describe, expect, test } from 'bun:test'
import { deriveLegend } from './series'
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
