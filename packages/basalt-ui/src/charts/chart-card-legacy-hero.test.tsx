/**
 * The legacy `value`/`delta` hero is drawn as one headline fact (the one anatomy `facts` has), never
 * handed to `WidgetHeader`'s title row: the value, delta and period sit under the title and follow
 * the facts gate (hidden while errored or empty, a skeleton while pending).
 */
import { render } from '@testing-library/react'
import { describe, expect, test } from 'bun:test'
import { ChartCard } from './ChartCard'

describe('ChartCard legacy value/delta hero', () => {
  test('value, delta and period land in the facts row, not WidgetHeader', () => {
    const { container } = render(
      <ChartCard title="T" value="99.9%" delta={0.4} deltaPeriod="last month">
        <div />
      </ChartCard>,
    )
    const facts = container.querySelector('[data-basalt-facts]')
    expect(facts?.querySelector('[data-basalt-fact-value]')?.textContent).toBe('99.9%')
    expect(facts?.querySelector('[data-delta]')?.textContent).toContain('last month')
    // WidgetHeader's own metrics row is gone.
    expect(container.querySelectorAll('[data-delta]')).toHaveLength(1)
  })

  test('a delta alone draws no empty value node', () => {
    const { container } = render(
      <ChartCard title="T" delta={0.4}>
        <div />
      </ChartCard>,
    )
    expect(container.querySelector('[data-basalt-fact-value]')).toBeNull()
    expect(container.querySelector('[data-delta]')).not.toBeNull()
  })

  test.each([
    ['pending', { pending: true }, true],
    ['empty', { empty: 'None.' }, false],
  ] as const)('%s: the hero follows the facts gate', (_, state, skeleton) => {
    const { container } = render(
      <ChartCard title="T" value="1" state={state}>
        <div />
      </ChartCard>,
    )
    expect(container.querySelector('[data-basalt-fact]')).toBeNull()
    expect(container.querySelector('[data-basalt-facts-skeleton]') !== null).toBe(skeleton)
  })
})
