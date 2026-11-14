/**
 * `basalt-ui/charts` exports the card `docs/chart-card.md` describes (`phase`, `figure`, `chart`);
 * the 2.x card (`state`, `facts`, children) is `LegacyChartCard` until `v3-teardown-views`.
 */
import { expect, test } from 'bun:test'
import { ChartCard, LegacyChartCard } from './index'
import type { ChartCardProps, LegacyChartCardProps } from './index'

test('the barrel ChartCard takes phase, figure and chart; the legacy one takes state and facts', () => {
  const v3: ChartCardProps = {
    title: 'Orders',
    phase: 'ready',
    figure: { value: 12, unit: 'EUR' },
    chart: () => null,
  }
  // @ts-expect-error the 2.x `state` prop is not on the v3 card
  const bad: ChartCardProps = { title: 'Orders', state: { pending: true }, chart: () => null }
  const legacy: LegacyChartCardProps = { title: 'Orders', state: { pending: true } }
  // @ts-expect-error the v3 `phase` prop is not on the legacy card
  const wrong: LegacyChartCardProps = { title: 'Orders', phase: 'ready' }

  expect([v3, bad, legacy, wrong]).toHaveLength(4)
  expect(ChartCard).not.toBe(LegacyChartCard)
})
