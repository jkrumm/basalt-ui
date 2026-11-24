import { useFormat } from 'basalt-ui'
import { BarList, DataPanel, StatCard } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { ChartCard, Lines, Sparkline, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT } from 'basalt-ui/tokens'
import { N88_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { buildFixture } from './fixture'
import type { Day, SeatRow } from './fixture'

const c = col<SeatRow>()
const COLUMNS = [
  c.entity('seat', { header: 'Seat', priority: 1, sortable: false }),
  c.number('issues', { header: 'Issues', priority: 1, sortable: false }),
  c.number('regressions', { header: 'Regressions', priority: 2, sortable: false }),
  c.number('refusals', { header: 'Refusals', priority: 2, sortable: false }),
  c.meter('cycleMin', { header: 'Median cycle, min', max: 60, priority: 2, sortable: false }),
]

const EMPTY = {
  cause: 'Nothing was reviewed in the window. Start a review to see it here.',
}
const ERROR = 'Could not reach the log. Retry to load again.'
const retry = (): undefined => undefined

const signed = (n: number, unit: string): string =>
  n === 0 ? `0 ${unit}` : `${n < 0 ? '−' : '+'}${Math.abs(n)} ${unit}`

export function ExprN88Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const data = buildFixture(fixture, shotState === 'empty')
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: ERROR, retry }
        : 'ready'
  const ready = shotState === undefined
  const empty = shotState === 'empty' ? EMPTY : null
  const [light, lead] = data.seats
  const hasLight = ready && light.issues > 0

  const pct = (v: number | null): string => (v === null ? 'none yet' : f.percent(v / 100))
  const reading = (d: Day): string => `Light ${pct(d.lightRate)}, lead ${pct(d.leadRate)}`
  const focus = useChartFocus(data.days, {
    announce: (d) => `${f.date(d.at, 'day')}: ${reading(d)}`,
  })

  const firstRate = data.days.find((d) => d.lightRate !== null)
  const lastDay = data.days.at(-1)
  const idDay = new Map(data.reviews.map((r) => [r.id, r.day]))

  const table = useDataTable({
    id: 'n88-seats',
    label: 'Reviewer record',
    columns: COLUMNS,
    data: ready ? data.seats : undefined,
    getRowId: (r) => r.key,
    mode: { kind: 'client' },
    phase,
    empty,
    bodyRows: 2,
  })

  const passDelta =
    hasLight && light.firstPassPct !== null && lead.firstPassPct !== null
      ? signed(light.firstPassPct - lead.firstPassPct, 'pts')
      : ''
  const costRatio =
    hasLight && light.costUsd !== null && lead.costUsd !== null
      ? light.costUsd / lead.costUsd - 1
      : null
  const costDelta =
    costRatio === null ? '' : `${costRatio < 0 ? '−' : '+'}${f.percent(Math.abs(costRatio))}`
  const moved = hasLight && light.movedUp !== null ? light.movedUp / light.issues : null

  return (
    <Page area="n88-review-seats">
      <PageBar title="Review seats, last 30 days" />
      <div className="grid gap-3 @wide:grid-cols-3">
        <div className="@wide:col-span-2">
          <ChartCard
            title="First-pass rate"
            subtitle="Running share of Issues verified"
            phase={phase}
            empty={empty}
            height="tall"
            figure={{
              value:
                hasLight && light.firstPassPct !== null
                  ? f.percent(light.firstPassPct / 100)
                  : null,
              delta: {
                value: passDelta,
                polarity: 'neutral',
                label: passDelta === '' ? '' : 'vs lead',
              },
              period:
                ready && lastDay !== undefined
                  ? focus.readout(f.date(lastDay.at, 'day'), (d) => f.date(d.at, 'day'))
                  : '',
              periodMono: true,
              status: {
                tone: 'neutral',
                label: !ready
                  ? ''
                  : focus.readout(
                      light.issues === 0
                        ? 'Light has not started'
                        : `${data.verifiedLight} of ${data.issuesLight} have a result`,
                      reading,
                    ),
              },
            }}
            footer={[
              {
                label: 'Lead',
                value:
                  ready && lead.firstPassPct !== null ? f.percent(lead.firstPassPct / 100) : '',
              },
            ]}
            chart={(box) => (
              <Lines
                label="Rate by day for light and lead"
                data={data.days}
                height={box.height}
                focus={focus}
                tooltip={false}
                naming="endLabels"
                x={{ value: (d) => d.at, format: (x) => f.date(new Date(x), 'day') }}
                y={{
                  title: '% passed first time',
                  domain: { ceil: 100, pad: 0.1 },
                  format: (v) => f.percent(v / 100),
                }}
                zones={
                  firstRate === undefined
                    ? []
                    : [
                        {
                          axis: 'x',
                          from: data.days[0]?.at ?? firstRate.at,
                          to: firstRate.at,
                          fill: BASALT.hover,
                          label: 'Light not rated yet',
                        },
                      ]
                }
                series={[
                  {
                    mark: 'line',
                    key: 'lead',
                    label: 'Lead seat',
                    color: N88_SERIES.lead,
                    y: (d) => d.leadRate,
                    format: (v) => f.percent(v / 100),
                  },
                  {
                    mark: 'line',
                    key: 'light',
                    label: 'Light seat',
                    color: N88_SERIES.light,
                    weight: 'strong',
                    y: (d) => d.lightRate,
                    format: (v) => f.percent(v / 100),
                  },
                ]}
              />
            )}
          />
        </div>
        <div className="grid gap-3 grid-rows-2">
          <StatCard
            title="Cost per Issue"
            subtitle="Light seat"
            phase={phase}
            empty={empty}
            value={hasLight && light.costUsd !== null ? f.money(light.costUsd, 'USD') : null}
            delta={{
              value: costDelta,
              polarity: 'neutral',
              label: costDelta === '' ? '' : 'vs lead',
            }}
            footer={[
              {
                label: 'Lead',
                value: ready && lead.costUsd !== null ? f.money(lead.costUsd, 'USD') : '',
              },
            ]}
            height={120}
            chart={(box) => (
              <Sparkline
                label="Cost by day, the lead as the line"
                points={data.days.map((d) => d.lightCost)}
                height={box.height}
                reference={lead.costUsd ?? 'mean'}
                format={(v) => f.money(v, 'USD')}
              />
            )}
          />
          <StatCard
            title="Moved up to the lead"
            subtitle="Of the light seat's work"
            info="Moved up means handed to the lead after the light review. Whether the light still saves money depends on the lead's cost on those, which is not logged yet."
            phase={phase}
            empty={empty}
            value={moved === null ? null : f.percent(moved)}
            sub={
              moved === null || light.movedUp === null ? '' : `${light.movedUp} of ${light.issues}`
            }
            footer={[{ label: 'Break-even', value: ready ? 'Not measured' : '' }]}
            height={96}
            chart={(box) => (
              <Sparkline
                label="Moved-up share by day"
                points={data.days.map((d) => d.lightMoved)}
                height={box.height}
                format={(v) => f.percent(v / 100)}
              />
            )}
          />
        </div>
      </div>
      <div className="grid gap-3 @wide:grid-cols-3">
        <div className="@wide:col-span-2">
          <DataPanel
            title="Regressions and refusals"
            subtitle="Cycle time is the median per Issue"
            phase={phase}
            empty={empty}
            bodySize={{ rows: 3 }}
            body={() => <DataTable table={table} focusSeries={{ focus, key: (r) => r.key }} />}
          />
        </div>
        <BarList
          title="Costliest Issues"
          subtitle="Either seat"
          phase={phase}
          empty={empty}
          mono
          bodyRows={3}
          items={
            ready
              ? data.costliest.map((r) => ({
                  key: r.id,
                  label: r.id,
                  value: r.costUsd,
                  secondary: `${r.seat === 'light' ? 'Light' : 'Lead'}, ${r.attempts} attempts`,
                }))
              : []
          }
          format={(v) => f.money(v, 'USD')}
          focusItems={{ focus, holds: (row, d) => idDay.get(row.key ?? '') === d.day }}
        />
      </div>
    </Page>
  )
}
