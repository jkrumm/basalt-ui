/**
 * Expression c12: a team lead checks AI spend. Are we inside this week's budget, and which model
 * drives the cost? One card answers the first (the week against its pace and budget), one chart
 * the second by day, one list by share; the chart's focus joins all three.
 */
import { useFormat } from 'basalt-ui'
import { BarList, StatCard } from 'basalt-ui/cards'
import type { Delta, Phase } from 'basalt-ui/cards'
import { Bars, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { alpha, BASALT } from 'basalt-ui/tokens'
import { Meter } from 'basalt-ui/ui/meter'
import { BUDGET_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { spendFixture } from './fixture'
import { readSpend, type DayRow } from './model'

const retry = (): void => undefined

export function ExprC12Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const spend = readSpend(spendFixture(fixture))
  const ready = shotState === undefined
  const isEmpty = shotState === 'empty'
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The billing API did not answer.', retry }
        : 'ready'

  const usd = (n: number): string =>
    f.money(n, 'USD', { maximumFractionDigits: 0, currencyDisplay: 'narrowSymbol' })
  const signed = (n: number): string => `${n < 0 ? '−' : '+'}${usd(Math.abs(n))}`
  const dayShort = (key: DayRow['key']): string => f.date(key, 'weekday', { day: 'numeric' })
  const dayLong = (key: DayRow['key']): string =>
    f.date(key, 'weekday', { day: 'numeric', month: 'short' })
  const hour = (h: number): string =>
    `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`

  const { rows, models } = spend
  const focus = useChartFocus(rows, {
    announce: (d) =>
      `${dayLong(d.key)}: ${models.map((m) => `${m.name} ${usd(d.costs[m.id])}`).join(', ')}`,
  })
  const labels = new Map<string, string>(rows.map((d) => [d.key, dayShort(d.key)]))
  const today = rows.find((d) => d.key === spend.today)

  /** A day against the budget's daily pace; today only against the hours that passed. */
  const dayDelta = (d: DayRow): Delta => {
    const pace = d.partial ? spend.dailyPace * (spend.hoursElapsed / 24) : spend.dailyPace
    return {
      value: signed(d.total - pace),
      polarity: d.total > pace ? 'up-bad' : 'neutral',
      label: d.partial ? 'vs pace so far' : 'vs budget pace',
    }
  }
  const complete = rows.filter((d) => !d.partial)
  const over = complete.filter((d) => d.total > spend.dailyPace).length
  const share = spend.weekTotal > 0 ? (models[0]?.week ?? 0) / spend.weekTotal : 0

  const weekDelta: Delta = {
    value: signed(spend.weekTotal - spend.paceSoFar),
    polarity: spend.weekTotal > spend.paceSoFar ? 'up-bad' : 'neutral',
    label: 'vs even pace',
  }
  const meterMax = Math.max(spend.budget * 1.25, spend.weekTotal * 1.1)

  return (
    <Page area="expr-c12">
      <PageBar title="AI spend against the weekly budget" />
      <div className="grid items-start gap-4 @wide:grid-cols-3">
        <div className="min-w-0 @wide:col-start-3 @wide:row-start-1">
          <StatCard
            title="Spend this week"
            subtitle={`Since Monday, all models, ${usd(spend.budget)} budget`}
            info="Gateway cost across all models since Monday. Lower is better."
            phase={phase}
            empty={isEmpty ? { cause: 'No spend this week yet.' } : null}
            value={ready ? usd(spend.weekTotal) : null}
            delta={ready ? weekDelta : undefined}
            sub={ready && share > 0 ? `${models[0]?.name} is ${f.percent(share)} of it` : undefined}
            chart={() => (
              <Meter
                label="Spend this week against the weekly budget"
                value={spend.weekTotal}
                max={meterMax}
                format={usd}
                zones={[
                  { to: spend.paceSoFar, tone: 'neutral', label: 'Under pace' },
                  { to: spend.budget, tone: 'warn', label: 'Over pace' },
                  { to: meterMax, tone: 'bad', label: 'Over budget' },
                ]}
              />
            )}
            footer={[
              { label: 'Projected week', value: ready ? usd(spend.projected) : '' },
              { label: 'Budget', value: usd(spend.budget) },
            ]}
          />
        </div>
        <div className="min-w-0 @wide:col-span-2 @wide:col-start-1 @wide:row-span-2 @wide:row-start-1">
          <ChartCard
            title="Daily spend by model"
            subtitle="Last 14 days, USD per day"
            height="tall"
            phase={phase}
            empty={
              isEmpty
                ? {
                    cause:
                      'No spend in the last 14 days. It appears here once a model call is billed.',
                  }
                : null
            }
            figure={
              ready
                ? {
                    // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle c12, kept as its builder left it: its figure follows focus, built before figure-readout
                    value: usd(focus.readout(today?.total ?? 0, (d) => d.total)),
                    // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle c12, kept as its builder left it: its figure follows focus, built before figure-readout
                    delta: focus.readout(today ? dayDelta(today) : undefined, dayDelta),
                    period: focus.readout(
                      `Today until ${hour(spend.hoursElapsed)}`,
                      (d) => `${dayLong(d.key)}: ${d.top.name} ${usd(d.top.cost)}`,
                    ),
                    periodMono: focus.datum === null,
                  }
                : undefined
            }
            footer={[
              { label: 'Days over pace', value: ready ? `${over} of ${complete.length}` : '' },
              {
                label: '14-day total',
                value: ready ? usd(rows.reduce((t, d) => t + d.total, 0)) : '',
              },
            ]}
            chart={(box) => (
              <Bars
                label="Daily AI spend by model over the last 14 days"
                height={box.height}
                data={rows}
                focus={focus}
                tooltip={false}
                x={{ value: (d) => d.key, format: (k) => labels.get(String(k)) ?? '' }}
                y={{ domain: [0, spend.cap], title: 'USD per day', format: usd }}
                series={models.map((m, i) => ({
                  mark: 'bar',
                  key: m.id,
                  label: m.name,
                  color: BUDGET_SERIES[m.role],
                  y: (d: DayRow) => d.costs[m.id],
                  format: usd,
                  opacity: (d: DayRow) => (d.partial ? 0.45 : 1),
                  values: i === models.length - 1 ? (_v: number, d: DayRow) => usd(d.total) : false,
                }))}
                zones={[
                  {
                    axis: 'x',
                    from: spend.today,
                    to: spend.today,
                    fill: alpha(BASALT.inkMuted, 0.12),
                    label: 'Partial',
                  },
                ]}
                refLines={[
                  {
                    value: spend.dailyPace,
                    color: BUDGET_SERIES.pace,
                    dashed: true,
                    label: `Budget pace ${usd(spend.dailyPace)}`,
                  },
                  {
                    value: spend.weekStart,
                    axis: 'x',
                    at: 'start',
                    color: BUDGET_SERIES.week,
                    dashed: true,
                    label: 'This week',
                  },
                ]}
              />
            )}
          />
        </div>
        <div className="min-w-0 @wide:col-start-3 @wide:row-start-2">
          <BarList
            title="Spend by model"
            subtitle="This week so far"
            phase={phase}
            empty={isEmpty ? { cause: 'No model has spend this week.' } : null}
            bodyRows={4}
            max={Math.max(spend.weekTotal, 1)}
            format={usd}
            series={models.map((m) => ({ key: m.id, label: m.name, color: BUDGET_SERIES[m.role] }))}
            items={models.map((m) => ({
              key: m.id,
              label: m.name,
              value: m.week,
              parts: { [m.id]: m.week },
            }))}
            focusSeries={{ focus, key: (row) => row.key ?? row.label }}
          />
        </div>
      </div>
    </Page>
  )
}
