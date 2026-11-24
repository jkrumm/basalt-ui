import { CircleOff, KeyRound, Users } from 'lucide-react'
import { Bars, ChartCard, Lines, useChartFocus } from 'basalt-ui/charts'
import type { LegendEntry } from 'basalt-ui/charts'
import { DataPanel, StatCell, StatGroup } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { useFormat } from 'basalt-ui'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { N84_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { CAP, CUTOVER_INDEX, dayAt, makeReport } from './fixture'
import type { Variant } from './fixture'
import { atOf, buildModel } from './model'
import type { Day, LeakRow, Model } from './model'

const MODELS_BY_VARIANT: Record<Variant, Model> = {
  rest: buildModel(makeReport('rest')),
  idle: buildModel(makeReport('idle')),
  spike: buildModel(makeReport('spike')),
}
const EMPTY_MODEL = buildModel({ entries: [], unreported: [] })

const variantOf = (fixture: string | undefined): Variant =>
  fixture === 'idle' || fixture === 'spike' ? fixture : 'rest'

/** Both panes share one cursor and one y gutter, so their plots line up. */
const CURSOR = 'n84-days'
const GUTTER = 64

/** The y domain that reaches zero, leaves a fifth of headroom for the rule labels and stops at `limit`: a value past it draws the kit's off-scale caret. */
const headroom =
  (limit: number) =>
  ([, hi]: readonly [number, number]): [number, number] => [0, Math.min(hi * 1.2, limit)]

const retryKeys = (): void => undefined
const retryUsage = (): void => undefined

/** The one name of each key, in the strip, on the line ends, in the table and in the announcements. */
const KEY_NAME = { team: 'Team key', gateway: 'Gateway key', nokey: 'No key' } as const

const c = col<LeakRow>()

export function ExprN84Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const model = shotState === 'empty' ? EMPTY_MODEL : MODELS_BY_VARIANT[variantOf(fixture)]
  const { days, rows, summary } = model
  const loading = shotState === 'loading'
  const ready = !loading && shotState !== 'error'
  const keysPhase: Phase =
    shotState === 'error' ? { tag: 'error', retry: retryKeys } : loading ? 'loading' : 'ready'
  const usagePhase: Phase =
    shotState === 'error' ? { tag: 'error', retry: retryUsage } : loading ? 'loading' : 'ready'

  const money = (n: number): string => f.money(n, 'USD', { maximumFractionDigits: 0 })
  const signed = (n: number): string => `${n < 0 ? '−' : '+'}${money(Math.abs(n))}`
  const dayText = (day: string): string => f.date(atOf(day), 'day')

  const focus = useChartFocus(days, {
    announce: (d) =>
      d.outside === null
        ? `${dayText(d.day)}: ${KEY_NAME.team} not reported, ${KEY_NAME.nokey} ${money(d.nokey)}`
        : `${dayText(d.day)}: ${KEY_NAME.team} ${money(d.team ?? 0)}, ${KEY_NAME.nokey} ${money(d.nokey)}, ${KEY_NAME.gateway} ${money(d.gateway)}`,
  })

  const outsideMax = Math.max(0, ...days.map((d) => d.outside ?? 0))
  const dayDomain = headroom(outsideMax > 150 ? 110 : Infinity)

  const table = useDataTable({
    id: 'n84-still-billing',
    label: 'Billing models',
    columns: [
      c.entity('model', { header: 'Model', mono: true, priority: 1, sortable: false }),
      c.meter('spend', {
        header: 'Spent, $',
        max: Math.max(1, ...rows.map((r) => r.spend)),
        card: 'value',
        priority: 2,
      }),
      c.text('through', {
        header: 'Billed through',
        labels: { team: KEY_NAME.team, nokey: KEY_NAME.nokey },
        priority: 1,
        card: 'meta',
        sortable: false,
      }),
    ],
    data: rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase: usagePhase,
    bodyRows: 6,
    phone: 'columns',
    empty:
      shotState === 'empty'
        ? { cause: 'Nothing to list until the report loads.' }
        : { cause: 'No model bills outside the gateway.' },
  })

  const overCap = (total: number): number => total - CAP
  const capDelta = (total: number) => ({
    value: signed(overCap(total)),
    polarity: overCap(total) > 0 ? ('up-bad' as const) : ('neutral' as const),
    label: 'vs cap',
  })
  const meterFor = (label: string, total: number) => {
    const max = Math.max(CAP * 1.2, total * 1.1)
    return {
      label,
      value: ready ? total : null,
      max,
      zones: [
        { to: CAP, tone: 'neutral' as const, label: 'Under cap' },
        { to: max, tone: 'bad' as const, label: 'Over cap' },
      ] as const,
      // cycle-expression-17: the meter prints its own value under the figure that says it; a blank format keeps only the marker and the zone word
      format: () => '',
    }
  }

  const legend: LegendEntry[] = [
    { key: 'outside', label: 'Before the cutover', color: N84_SERIES.outside, swatch: 'bar' },
    { key: 'leak', label: 'After the cutover', color: N84_SERIES.leak, swatch: 'bar' },
  ]

  const cutover = dayAt(CUTOVER_INDEX)
  const lastBilled = rows.reduce((latest, r) => (r.last > latest ? r.last : latest), '')

  return (
    <Page area="expr-n84">
      <PageBar title="API key spend, last 30 days" />
      <StatGroup variant="cards" label="Keys">
        <StatCell
          icon={Users}
          title={KEY_NAME.team}
          swatch={N84_SERIES.outside}
          value={ready ? money(summary.team) : null}
          delta={capDelta(summary.team)}
          meter={meterFor(KEY_NAME.team, summary.team)}
          phase={keysPhase}
          empty={model.empty ? { cause: 'No team rows to read.' } : null}
        />
        <StatCell
          icon={KeyRound}
          title={KEY_NAME.gateway}
          swatch={N84_SERIES.gateway}
          value={ready ? money(summary.gateway) : null}
          delta={capDelta(summary.gateway)}
          meter={meterFor(KEY_NAME.gateway, summary.gateway)}
          phase={keysPhase}
          empty={model.empty ? { cause: 'No usage yet.' } : null}
        />
        <StatCell
          icon={CircleOff}
          title={KEY_NAME.nokey}
          value={ready ? money(summary.nokey) : null}
          delta={{
            value: signed(summary.nokey - summary.nokeyBefore),
            polarity: 'neutral',
            label: 'vs the window before',
          }}
          sub="No cap applies"
          phase={keysPhase}
          empty={model.empty ? { cause: 'No keyless rows reported.' } : null}
        />
      </StatGroup>
      <div className="grid gap-4 @wide:grid-cols-3">
        <div className="@wide:col-span-2">
          <ChartCard
            title="Spend by key"
            subtitle="Total against the cap, then each day"
            height="tall"
            phase={usagePhase}
            empty={
              model.empty ? { cause: 'Nothing to chart. Export the usage, then reload.' } : null
            }
            legend={legend}
            figure={{
              value: ready ? money(summary.outside) : null,
              delta: {
                value: ready ? signed(summary.outside - summary.outsideBefore) : '',
                polarity: 'neutral',
                label: `vs the ${summary.daysAfter} days before`,
              },
              period: focus.readout(ready ? `since ${dayText(cutover)}` : '', (d: Day) =>
                d.outside === null
                  ? `${dayText(d.day)}: no team report`
                  : `${dayText(d.day)}: ${money(d.outside)}`,
              ),
              periodMono: true,
              status: { tone: 'accent', label: ready ? 'Billing outside the gateway' : '' },
            }}
            footer={[
              {
                label: 'Days billed',
                value: ready ? `${summary.daysBilled} of ${summary.daysAfter}` : '',
              },
              {
                label: 'Last billed',
                value: ready && lastBilled !== '' ? dayText(lastBilled) : '',
                mono: true,
              },
            ]}
            panes={[
              {
                weight: 3,
                chart: (box) => (
                  <Lines
                    label="Total per key"
                    height={box.height}
                    data={days}
                    focus={focus}
                    tooltip={false}
                    cursor={CURSOR}
                    naming="endLabels"
                    x={{ value: (d) => d.at, ticks: [] }}
                    y={{
                      gutter: GUTTER,
                      title: 'Rolling total',
                      format: money,
                      domain: headroom(Infinity),
                    }}
                    series={[
                      {
                        mark: 'line',
                        key: 'team',
                        label: KEY_NAME.team,
                        color: N84_SERIES.outside,
                        weight: 'strong',
                        y: (d) => d.rollTeam,
                        format: money,
                      },
                      {
                        mark: 'line',
                        key: 'gateway',
                        label: KEY_NAME.gateway,
                        color: N84_SERIES.gateway,
                        weight: 'strong',
                        y: (d) => d.rollGateway,
                        format: money,
                      },
                    ]}
                    refLines={[
                      {
                        value: CAP,
                        color: N84_SERIES.cap,
                        dashed: true,
                        label: `${money(CAP)} cap`,
                      },
                    ]}
                  />
                ),
              },
              {
                weight: 2,
                chart: (box) => (
                  <Bars
                    label="Each day"
                    height={box.height}
                    data={days}
                    focus={focus}
                    tooltip={false}
                    cursor={CURSOR}
                    x={{ value: (d) => d.at, tickFormat: (x) => f.date(new Date(x), 'day') }}
                    y={{ gutter: GUTTER, title: 'Per day', format: money, domain: dayDomain }}
                    series={[
                      {
                        mark: 'bar',
                        key: 'outside',
                        label: 'Outside',
                        color: N84_SERIES.outside,
                        legend: false,
                        y: (d) => d.outside,
                        format: money,
                        highlight: (d) => d.index >= CUTOVER_INDEX && (d.outside ?? 0) > 0,
                      },
                    ]}
                    refLines={[
                      {
                        value: atOf(cutover),
                        axis: 'x',
                        at: 'start',
                        color: N84_SERIES.cap,
                        dashed: true,
                        label: 'Cutover',
                      },
                      ...(summary.missing === null
                        ? []
                        : [
                            {
                              value: atOf(summary.missing),
                              axis: 'x' as const,
                              color: N84_SERIES.cap,
                              dashed: true,
                              label: 'No report',
                            },
                          ]),
                    ]}
                  />
                ),
              },
            ]}
          />
        </div>
        <div className="@wide:self-start">
          <DataPanel
            title="Models still billing"
            subtitle="Largest first"
            phase={usagePhase}
            bodySize={{ rows: 7 }}
            body={() => (
              <DataTable
                table={table}
                focusItems={{ focus, holds: (row, d) => row.billedOn.includes(d.day) }}
              />
            )}
          />
        </div>
      </div>
    </Page>
  )
}
