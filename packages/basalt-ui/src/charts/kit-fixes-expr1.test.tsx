/**
 * Expression cycle 1's chart kit fixes (`docs/v3/cycles/expression-1.md` rows .8, .10, .19, .22):
 * a placeholder card keeps the facts and basis rows, a pending Heatmap draws a grid, a period never
 * opens a wrapped line with its separator, a Heatmap tooltip header stays whole.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { ChartCard } from './ChartCard'
import { cellHeader, colTicks, Heatmap } from './parts/heatmap'

afterEach(cleanup)

const FACTS = { value: '7.4', unit: 'h', comparison: '+0.3', period: ['last 30 d', '12 runs'] }

const heat = (
  <Heatmap
    ariaLabel="Deliveries"
    data={[{ r: 'a', c: '09', v: 1 }]}
    rows={['a', 'b', 'c']}
    getRow={(d) => d.r}
    getCol={(d) => d.c}
    getValue={(d) => d.v}
  />
)

describe('a placeholder card keeps the facts and basis rows', () => {
  for (const state of [{ pending: true }, { empty: 'Nothing here' }, { error: 'Failed' }]) {
    test(`${Object.keys(state)[0]}: the rows are laid out hidden, inert and unannounced`, () => {
      const { container } = render(
        <ChartCard title="Pace" facts={FACTS} subtitle="Median of 14 runs" state={state}>
          {null}
        </ChartCard>,
      )
      const reserve = container.querySelector('[data-basalt-facts-reserve]')
      expect(reserve).not.toBeNull()
      expect(reserve?.getAttribute('aria-hidden')).toBe('true')
      expect(reserve?.hasAttribute('inert')).toBe(true)
      // The text is drawn from an attribute: it sets the width, the DOM holds no figure.
      expect(reserve?.textContent).not.toContain('7.4')
      expect(reserve?.textContent).not.toContain('Median')
      expect(reserve?.querySelector('[data-reserve="Median of 14 runs"]')).not.toBeNull()
      expect(reserve?.querySelector('[data-reserve="7.4"]')).not.toBeNull()
      // Never a fact anchor: nothing queries it as a figure.
      expect(container.querySelector('[data-basalt-fact], [data-basalt-facts]')).toBeNull()
    })
  }

  test('at rest there is no reservation, and a card without facts reserves nothing', () => {
    const rest = render(<ChartCard title="Pace" facts={FACTS} subtitle="Basis" />)
    expect(rest.container.querySelector('[data-basalt-facts-reserve]')).toBeNull()
    expect(rest.container.querySelector('[data-basalt-facts]')).not.toBeNull()
    rest.unmount()
    const bare = render(<ChartCard title="Pace" state={{ empty: 'None' }} />)
    expect(bare.container.querySelector('[data-basalt-facts-reserve]')).toBeNull()
  })

  test('only a pending card paints the bars over the reservation', () => {
    const pending = render(<ChartCard title="P" facts={FACTS} state={{ pending: true }} />)
    expect(pending.container.querySelector('[data-basalt-facts-skeleton]')).not.toBeNull()
    pending.unmount()
    const empty = render(<ChartCard title="P" facts={FACTS} state={{ empty: 'None' }} />)
    expect(empty.container.querySelector('[data-basalt-facts-skeleton]')).toBeNull()
  })
})

describe('the pending ghost follows the chart inside', () => {
  test('a Heatmap body loads as a grid, not bars', () => {
    const { container } = render(
      <ChartCard title="Deliveries" state={{ pending: true }}>
        {heat}
      </ChartCard>,
    )
    const ghost = container.querySelector('[data-basalt-plot-ghost]')
    expect(ghost?.getAttribute('data-basalt-plot-ghost')).toBe('grid')
    expect(ghost?.children.length).toBe(48)
  })

  test('the grid ghost reserves the loaded box: the height its rows give', () => {
    const { container } = render(
      <ChartCard title="Deliveries" state={{ pending: true }}>
        {heat}
      </ChartCard>,
    )
    // 3 rows x 26 + 64 chrome = 142, floored at the 160 px minimum.
    expect(
      container.querySelector('[data-basalt-box]')?.firstElementChild?.getAttribute('style'),
    ).toContain('--bc-regular: 160px')
  })

  test('a bare pending Heatmap draws the grid too', () => {
    const { container } = render(
      <Heatmap
        ariaLabel="Deliveries"
        data={[]}
        getRow={() => ''}
        getCol={() => ''}
        getValue={() => 0}
        state={{ pending: true }}
      />,
    )
    expect(
      container.querySelector('[data-basalt-plot-ghost]')?.getAttribute('data-basalt-plot-ghost'),
    ).toBe('grid')
  })

  test('an explicit ghost still wins', () => {
    const { container } = render(
      <ChartCard title="Deliveries" state={{ pending: true }} ghost="bars">
        {heat}
      </ChartCard>,
    )
    expect(
      container.querySelector('[data-basalt-plot-ghost]')?.getAttribute('data-basalt-plot-ghost'),
    ).toBe('bars')
  })
})

describe('a ChartFact period never opens a wrapped line with its separator', () => {
  const NBSP = ' '

  test('every separator is glued to the item before it', () => {
    const { container } = render(
      <ChartCard title="T" facts={{ value: '1', period: 'last 30 d · 12 runs · 3 failed' }} />,
    )
    const period = container.querySelector('[data-basalt-fact] span:last-child')
    expect(period?.textContent).toBe(`last 30 d${NBSP}· 12 runs${NBSP}· 3 failed`)
  })

  test('a leading separator after a unit shares a run with the unit', () => {
    const { container } = render(
      <ChartCard title="T" facts={{ value: '4', unit: 'h', period: ['basis'] }} />,
    )
    const tail = container.querySelector('[data-basalt-fact] > span:last-child')
    expect([...(tail?.children ?? [])].map((c) => c.textContent)).toEqual(['h', NBSP, '· basis'])
  })

  test('behind a comparison the separator shares a run with the comparison', () => {
    const { container } = render(
      <ChartCard
        title="T"
        facts={{ value: '4', unit: 'h', comparison: '+1', period: ['basis'] }}
      />,
    )
    const tail = container.querySelector('[data-basalt-fact] > span:last-child')
    expect(tail?.querySelector('[data-basalt-fact-delta]')).not.toBeNull()
    expect(tail?.textContent).toContain('· basis')
  })
})

describe('Heatmap tooltip header', () => {
  const id = (s: string): string => s
  test('a column the caller blanks from the ticks keeps its name in the header', () => {
    expect(cellHeader('orders', '09', id, (c) => (c === '09' ? '' : c))).toBe('orders · 09')
  })

  test('a formatted label wins over the key', () => {
    expect(cellHeader('orders', '09', id, (c) => `${c}:00`)).toBe('orders · 09:00')
  })
})

describe('Heatmap named tick columns', () => {
  const hours = Array.from({ length: 24 }, (_, h) => String(h))

  test('without a named column the ticks are the kit stride', () => {
    expect(colTicks(hours, undefined, 'regular')).toEqual(['0', '5', '10', '15', '20'])
    expect(colTicks(hours, ['x'], 'regular')).toEqual(['0', '5', '10', '15', '20'])
  })

  test('a named column keeps its tick and displaces the stride tick that would crowd it', () => {
    expect(colTicks(hours, ['9'], 'regular')).toEqual(['0', '5', '9', '15', '20'])
    expect(colTicks(hours, ['9'], 'compact')).toEqual(['0', '9', '16'])
    expect(colTicks(hours, ['9'], 'wide')).toEqual(['0', '4', '9', '12', '16', '20'])
  })

  test('a named column that is already a stride tick adds nothing', () => {
    expect(colTicks(hours, ['10'], 'regular')).toEqual(['0', '5', '10', '15', '20'])
  })

  test('the ticks stay in column order whatever order the names come in', () => {
    expect(colTicks(hours, ['22', '9'], 'regular')).toEqual(['0', '5', '9', '15', '22'])
  })
})
