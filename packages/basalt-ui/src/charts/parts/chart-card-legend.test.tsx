/**
 * One legend behaviour: a `ChartCard` legend of two or more entries toggles and isolates the series
 * of the chart in its box, as the chart's own legend does (`toggledKeys`, `isolatedKeys`). The
 * keyboard path in a real browser is `tests/layout/charts-hover.layout.test.ts`.
 */
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import type { ReactElement } from 'react'
import { useCardHidden } from '../card-context'
import type { LegendEntry, Series, SeriesColor } from '../contract'
import { isolatedKeys, toggledKeys } from '../legend'
import { CartesianChart } from './cartesian'
import { ChartCard } from './chart-card'

afterEach(cleanup)

const pair = (v: string): SeriesColor => ({
  light: `var(--basalt-${v})`,
  dark: `var(--basalt-${v})`,
})
const ENTRIES: LegendEntry[] = [
  { key: 'a', label: 'Alpha', color: pair('chart-1') },
  { key: 'b', label: 'Beta', color: pair('chart-2') },
  { key: 'c', label: 'Gamma', color: pair('chart-3') },
]

type Row = { t: number; a: number; b: number; c: number }
const line = (key: 'a' | 'b' | 'c'): Series<Row> => ({
  mark: 'line',
  key,
  label: key,
  color: pair('chart-1'),
  legend: false,
  y: (d) => d[key],
})

function Probe(): ReactElement {
  return <i data-testid="hidden">{[...useCardHidden()].toSorted().join(',')}</i>
}

const card = (legend: LegendEntry[] = ENTRIES): ReactElement => (
  <ChartCard title="Cost" legend={legend} chart={() => <Probe />} />
)
const button = (key: string): HTMLElement =>
  document.querySelector<HTMLElement>(`[data-slot="chart-legend"] [data-legend-key="${key}"]`)!
const hidden = (): string => document.querySelector('[data-testid="hidden"]')!.textContent ?? ''
const pressed = (): string[] =>
  ['a', 'b', 'c'].map((k) => button(k).getAttribute('aria-pressed') ?? '')

describe('toggledKeys and isolatedKeys', () => {
  test('a toggle flips one key', () => {
    expect([...toggledKeys(new Set(), 'a')]).toEqual(['a'])
    expect([...toggledKeys(new Set(['a']), 'a')]).toEqual([])
  })

  test('an isolate hides every other key; again on the lone key shows them all', () => {
    const keys = ['a', 'b', 'c']
    const alone = isolatedKeys(new Set(), 'b', keys)
    expect([...alone].toSorted()).toEqual(['a', 'c'])
    expect([...isolatedKeys(alone, 'b', keys)]).toEqual([])
    // A hidden key isolated is shown, the rest hidden.
    expect([...isolatedKeys(new Set(['a']), 'a', keys)].toSorted()).toEqual(['b', 'c'])
  })

  test('a key outside the isolatable set (a reference line) keeps its state', () => {
    expect([...isolatedKeys(new Set(['ref']), 'a', ['a', 'b'])].toSorted()).toEqual(['b', 'ref'])
    expect([...isolatedKeys(new Set(['b']), 'a', ['a', 'b'])]).toEqual([])
  })
})

describe('ChartCard legend', () => {
  test('two or more entries are toggle buttons that hide the series in the box', () => {
    render(card())
    expect(pressed()).toEqual(['true', 'true', 'true'])
    fireEvent.click(button('b'))
    expect(hidden()).toBe('b')
    expect(pressed()).toEqual(['true', 'false', 'true'])
    fireEvent.click(button('b'))
    expect(hidden()).toBe('')
  })

  test('a modifier click isolates, and again shows them all', () => {
    render(card())
    for (const modifier of ['altKey', 'shiftKey', 'metaKey', 'ctrlKey'] as const) {
      fireEvent.click(button('a'), { [modifier]: true })
      expect(hidden()).toBe('b,c')
      expect(pressed()).toEqual(['true', 'false', 'false'])
      fireEvent.click(button('a'), { [modifier]: true })
      expect(hidden()).toBe('')
    }
  })

  test('a double click isolates: its two clicks cancel, the dblclick isolates', () => {
    render(card())
    fireEvent.click(button('c'))
    fireEvent.click(button('c'))
    fireEvent.doubleClick(button('c'))
    expect(hidden()).toBe('a,b')
  })

  test('one entry is a label, not a toggle', () => {
    render(card(ENTRIES.slice(0, 1)))
    expect(document.querySelectorAll('[data-slot="chart-legend"] button')).toHaveLength(0)
    expect(hidden()).toBe('')
  })

  test('a CartesianChart in the box draws without the series the card legend hid', async () => {
    const rows: Row[] = Array.from({ length: 4 }, (_, i) => ({ t: i, a: i, b: 2 * i, c: 3 * i }))
    const seen: string[][] = []
    const marks = CartesianChart.custom<Row>((plot) => {
      seen.push(plot.visible.map((s) => s.key))
      return []
    })
    render(
      <ChartCard
        title="Lines"
        legend={ENTRIES}
        chart={(box) => (
          <CartesianChart
            label="Lines"
            height={box.height}
            data={rows}
            x={{ value: (d) => d.t }}
            series={[line('a'), line('b'), line('c')]}
            marks={marks}
          />
        )}
      />,
    )
    expect(seen.at(-1)).toEqual(['a', 'b', 'c'])
    await act(async () => {
      fireEvent.click(button('a'), { altKey: true })
    })
    expect(seen.at(-1)).toEqual(['a'])
  })
})
