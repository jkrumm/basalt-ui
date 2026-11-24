import { useFormat } from 'basalt-ui'
import type { Phase } from 'basalt-ui/cards'
import { BarList, StatCard } from 'basalt-ui/cards'
import { Bars, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { Meter } from 'basalt-ui/ui/meter'
import { N98_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { summaryFor } from './fixture'
import type { ModelRow } from './fixture'

/** Misses past this are drawn on the plot's edge with the kit's off-scale caret. */
const CAP = 1.5

const HELD_DELTA = { value: '', polarity: 'neutral', label: '' } as const

export function ExprN98Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const summary = summaryFor(shotState === 'empty' ? 'fresh' : fixture)
  const { models, widest } = summary
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: () => undefined, message: 'The cost report did not answer.' }
        : 'ready'
  const ready = phase === 'ready'
  const idle = models.length === 0

  const signed = (miss: number | null): string => {
    if (miss === null) return '\u2013'
    const whole = Math.round(miss * 100)
    return `${whole > 0 ? '+' : whole < 0 ? '\u2212' : ''}${f.percent(Math.abs(whole) / 100)}`
  }

  const focus = useChartFocus(models, {
    announce: (m) =>
      `${m.name}: Standard ${signed(m.standard.miss)}, HD ${signed(m.hd.miss)}, ${m.unpriced} unpriced, ${f.money(m.hidden, 'USD')} at estimate`,
  })

  const widestIn = (m: ModelRow, quality: 'standard' | 'hd'): boolean =>
    widest !== null && widest.miss !== 0 && widest.name === m.name && widest.quality === quality
  const overall = summary.overall ?? 0
  const gap = widest === null ? 0 : Math.round((widest.miss - overall) * 100)
  const guessed = models.filter((m) => m.basis === 'placeholder' || m.basis === 'extrapolated')
  const sameRate = models.filter((m) => m.basis === 'standard-rate')
  const names = (rows: readonly ModelRow[]): string =>
    rows.length === 0 ? 'None' : rows.map((m) => m.name).join(', ')

  return (
    <Page area="expr-n98">
      <PageBar title="Image cost, estimate against measured" />
      <div className="grid gap-4 @wide:grid-cols-3">
        <div className="@wide:col-span-2">
          <ChartCard
            title="Estimate miss by model and quality"
            subtitle="Measured cost over the plan's estimate"
            phase={phase}
            height="tall"
            empty={
              idle
                ? {
                    cause:
                      'No generations in this library yet. Generate a batch, then compare its cost with the estimate.',
                  }
                : null
            }
            figure={
              ready && widest !== null
                ? {
                    value: signed(widest.miss),
                    period: focus.readout(
                      widest.miss === 0
                        ? 'Every estimate held'
                        : `${widest.name}, ${widest.quality === 'hd' ? 'HD' : 'Standard'}`,
                      (m) =>
                        `${m.name}: Standard ${signed(m.standard.miss)}, HD ${signed(m.hd.miss)}`,
                    ),
                    delta: {
                      value: `${gap > 0 ? '+' : gap < 0 ? '\u2212' : ''}${Math.abs(gap)} pts`,
                      polarity: 'neutral',
                      label: `vs ${signed(overall)} overall`,
                    },
                  }
                : { value: null, period: '', delta: HELD_DELTA }
            }
            footer={[
              {
                label: 'Not measured',
                value: ready ? names(guessed) : '',
              },
              {
                label: 'HD as Standard',
                value: ready ? names(sameRate) : '',
              },
            ]}
            chart={() => (
              <Bars<ModelRow>
                label="Measured cost over estimate for each model at Standard and HD quality"
                data={models}
                focus={focus}
                tooltip={false}
                layout="grouped"
                x={{ value: (m) => m.name }}
                y={{
                  title: 'Over or under, %',
                  format: signed,
                  domain: ([lo, hi]) => [Math.min(lo, -0.25), Math.min(Math.max(hi, 0.25), CAP)],
                }}
                refLines={[
                  { value: 0, color: N98_SERIES.estimate, dashed: true, label: 'Plan estimate' },
                ]}
                series={[
                  {
                    mark: 'bar',
                    key: 'standard',
                    label: 'Standard',
                    color: N98_SERIES.standard,
                    y: (m) => m.standard.miss,
                    format: signed,
                    values: true,
                    highlight: (m) => widestIn(m, 'standard'),
                  },
                  {
                    mark: 'bar',
                    key: 'hd',
                    label: 'HD',
                    color: N98_SERIES.hd,
                    y: (m) => m.hd.miss,
                    format: signed,
                    values: true,
                    highlight: (m) => widestIn(m, 'hd'),
                  },
                ]}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <StatCard
              title="Spend with no price"
              phase={phase}
              empty={idle ? { cause: '\u2014' } : null}
              value={ready ? f.money(summary.hidden, 'USD') : null}
              sub={ready ? `${summary.unpriced} of ${summary.entries} entries, at estimate` : ''}
              chartHeight={40}
              chart={() => (
                <Meter
                  label="Unpriced spend against planned spend"
                  value={summary.hidden}
                  max={summary.estimated}
                  format={(v) => f.percent(v / summary.estimated)}
                  caption={`of ${f.money(summary.estimated, 'USD')} planned`}
                />
              )}
            />
          </div>
          <BarList
            title="Unpriced spend by model"
            subtitle="In the chart's order"
            phase={phase}
            empty={idle ? { cause: '\u2014' } : null}
            focus={focus}
            bodyRows={5}
            format={(v) => f.money(v, 'USD')}
            items={models.map((m) => ({
              label: m.name,
              value: m.hidden,
              secondary: `${m.unpriced} entries`,
            }))}
          />
        </div>
      </div>
    </Page>
  )
}
