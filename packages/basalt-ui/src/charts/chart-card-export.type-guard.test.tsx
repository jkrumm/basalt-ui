/**
 * `basalt-ui/charts` exports the card `docs/chart-card.md` describes (`phase`, `figure`, `chart`);
 * the 2.x `state` and `facts` props are gone with the 2.x card.
 */
import { expect, test } from 'bun:test'
import { ChartCard } from './index'
import type { ChartCardProps } from './index'

test('the barrel ChartCard takes phase, figure and chart, and not the 2.x state', () => {
  const v3: ChartCardProps = {
    title: 'Orders',
    phase: 'ready',
    figure: { value: 12, unit: 'EUR' },
    chart: () => null,
  }
  // @ts-expect-error the 2.x `state` prop is not on the v3 card
  const bad: ChartCardProps = { title: 'Orders', state: { pending: true }, chart: () => null }

  expect([v3, bad]).toHaveLength(2)
  expect(typeof ChartCard).toBe('function')
})
