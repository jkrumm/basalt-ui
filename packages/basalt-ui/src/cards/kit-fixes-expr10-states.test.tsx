/**
 * Expression cycle 10 (`v3-expr-10-kit-fixes` 3): a `ChartCard` in the empty phase prints a dash for
 * each footer value, as error does, so no label stands with nothing beside it.
 */
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'bun:test'
import { ChartCard } from '../charts/parts/chart-card'

afterEach(cleanup)

const footer = [
  { label: 'Peak', value: 5 },
  { label: 'Open', value: '12' },
] as const

const values = (container: HTMLElement): (string | null)[] =>
  [...container.querySelectorAll('[data-slot="chart-footer"] dd')].map((dd) => dd.textContent)

describe('ChartCard footer in the empty phase', () => {
  test('a footer the page declared prints a dash for each value', () => {
    const { container } = render(
      <ChartCard
        title="Runs"
        chart={() => null}
        footer={footer}
        empty={{ cause: 'No runs yet' }}
      />,
    )
    expect(values(container)).toEqual(['–', '–'])
  })

  test('the labels held from a ready frame get a dash, not a blank', () => {
    const { container, rerender } = render(
      <ChartCard title="Runs" chart={() => null} footer={footer} />,
    )
    expect(values(container)).toEqual(['5', '12'])
    rerender(<ChartCard title="Runs" chart={() => null} empty={{ cause: 'No runs yet' }} />)
    expect(container.querySelector('[data-slot="chart-footer"] dt')?.textContent).toBe('Peak')
    expect(values(container)).toEqual(['–', '–'])
  })
})
