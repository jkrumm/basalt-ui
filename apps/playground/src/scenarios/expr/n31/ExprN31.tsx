import { text } from '@tanstack/charts/text'
import { useFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { BASALT } from 'basalt-ui/tokens'
import { Lozenge } from 'basalt-ui/ui/badge'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import { SHIP_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { BURST_WEEK, DEFAULT_WEEK, type Day, type Week } from './fixture'

const MINUS = '−'

const signed = (n: number): string =>
  n === 0 ? '0' : `${n > 0 ? '+' : MINUS}${Math.abs(Math.round(n * 10) / 10)}`

function weekFor(fixture: string | undefined): Week {
  return fixture === 'burst' ? BURST_WEEK : DEFAULT_WEEK
}

export function ExprN31Scenario({ shotState, fixture }: ScenarioProps) {
  const week = weekFor(fixture)
  const fmt = useFormat()
  const { days } = week
  const shipped = days.reduce((sum, d) => sum + d.done, 0)
  const dropped = days.reduce((sum, d) => sum + d.dropped, 0)
  const perDay = shipped / days.length
  const dayName = (d: Day) => fmt.date(d.at, 'weekday')
  const lastKey = days[days.length - 1]?.key
  const dayLong = (d: Day) =>
    `${dayName(d)} ${fmt.date(d.at, 'short')}${d.key === lastKey ? ', so far' : ''}`
  const focus = useChartFocus(days, {
    announce: (d) => `${dayLong(d)}: ${d.done} shipped, ${d.dropped} dropped`,
  })

  const phase =
    shotState === 'loading'
      ? ('loading' as const)
      : shotState === 'error'
        ? { tag: 'error' as const, message: 'The factory did not answer.', retry: () => undefined }
        : ('ready' as const)
  const ready = phase === 'ready' && shotState !== 'empty'
  const empty =
    shotState === 'empty'
      ? {
          cause:
            'No Issues were closed in these 7 days. Closed Issues appear here the day they close.',
        }
      : null
  const deployed = `${fmt.date(week.deployedAt, 'weekday')} ${fmt.time(week.deployedAt, { hour: '2-digit', minute: '2-digit', hour12: false })} UTC`

  const figure = ready
    ? {
        value: focus.readout<number | string>(shipped, (d) => d.done),
        unit: 'shipped',
        delta: focus.readout(
          {
            value: signed(shipped - week.priorShipped),
            polarity: 'up-good' as const,
            label: 'vs prior 7 days',
          },
          (d) => ({
            value: signed(d.done - perDay),
            polarity: 'up-good' as const,
            label: `vs ${Math.round(perDay * 10) / 10} a day`,
          }),
        ),
        period: focus.readout('7 days', dayLong),
        status: focus.readout({ tone: 'neutral' as const, label: `${dropped} dropped` }, (d) => ({
          tone: 'neutral' as const,
          label: `${d.dropped} dropped`,
        })),
      }
    : { value: null }

  const footer = [
    { label: 'In production', value: shotState === 'loading' ? '' : week.sha, mono: true },
    { label: 'Deployed', value: shotState === 'loading' ? '' : deployed, mono: true },
  ] as const

  const maxShipped = Math.max(...days.map((d) => d.done))

  return (
    <Page area="expr-n31">
      <PageBar title="ledger-sync, shipped in the last 7 days" />
      <div className="@container">
        <div className="grid items-stretch gap-4 @wide:grid-cols-2">
          <ChartCard
            title="Issues shipped per day"
            subtitle="Closed as done, by kind"
            phase={phase}
            empty={empty}
            figure={figure}
            footer={footer}
            height="fill"
            chart={() => (
              <CartesianChart<Day>
                label="Issues shipped per day, by kind"
                data={days}
                focus={focus}
                tooltip={false}
                x={{
                  value: (d) => d.key,
                  format: (k) =>
                    k === lastKey
                      ? 'Today'
                      : fmt.date(new Date(`${String(k)}T00:00:00Z`), 'weekday'),
                  ticks: days.map((d) => d.key),
                }}
                y={{
                  title: 'Issues',
                  domain: { floor: 0, ceil: maxShipped + 1 },
                  format: (v) => (Number.isInteger(v) ? String(v) : ''),
                }}
                refLines={[
                  {
                    axis: 'x',
                    value: week.deployDayKey,
                    color: SHIP_SERIES.deploy,
                    dashed: true,
                    label: 'Deployed',
                  },
                ]}
                series={[
                  {
                    mark: 'bar',
                    key: 'feat',
                    label: 'Feature',
                    color: SHIP_SERIES.feat,
                    y: (d) => d.feat,
                  },
                  {
                    mark: 'bar',
                    key: 'fix',
                    label: 'Fix',
                    color: SHIP_SERIES.fix,
                    y: (d) => d.fix,
                  },
                  {
                    mark: 'bar',
                    key: 'chore',
                    label: 'Chore',
                    color: SHIP_SERIES.chore,
                    y: (d) => d.chore,
                  },
                ]}
                marks={CartesianChart.custom<Day>((plot) => {
                  const { placed } = chartLabels.place(
                    plot.data.map((d) => ({
                      key: d.key,
                      text: String(d.done),
                      x: plot.x(d.key) ?? 0,
                      y: plot.y(d.done),
                    })),
                    { width: plot.plotWidth, height: plot.plotHeight },
                    {
                      gap: 2,
                      // cycle-expression-8: the kit did not hand a refLine's pixel box to chartLabels, so the deploy rule is an obstacle by hand
                      obstacles: [
                        {
                          left: (plot.x(week.deployDayKey) ?? 0) - 2,
                          top: 0,
                          width: 4,
                          height: plot.plotHeight,
                        },
                      ],
                    },
                  )
                  return [
                    text(placed, {
                      x: (l) => l.key,
                      y: (l) => Number(plot.data.find((d) => d.key === l.key)?.done ?? 0),
                      text: (l) => l.text,
                      dx: (l) => l.dx,
                      dy: (l) => l.dy,
                      anchor: (l) => l.textAnchor,
                      fill: BASALT.ink,
                      fontSize: BASALT.text.micro,
                    }),
                  ]
                })}
              />
            )}
          />
          <DataPanel
            title="Closed Issues by day"
            subtitle="Newest day last"
            phase={phase}
            empty={empty === null ? null : { cause: 'Nothing closed to list.' }}
            bodySize={{ height: 384 }}
            body={() => (
              <ScrollArea
                aria-label="Closed Issues by day"
                className="max-h-96"
                onPointerLeave={focus.target.onPointerLeave}
              >
                <div className="flex flex-col gap-3">
                  {days.map((d, i) => (
                    <div
                      key={d.key}
                      {...focus.item(i)}
                      className="flex flex-col gap-1 rounded-chip p-2 data-focused:bg-selected"
                    >
                      <div className="flex items-baseline justify-between gap-2 text-sm font-medium">
                        <span>{dayLong(d)}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {d.done} shipped{d.dropped > 0 ? `, ${d.dropped} dropped` : ''}
                        </span>
                      </div>
                      {d.issues.length === 0 ? (
                        <div className="text-sm text-muted-foreground">Nothing closed</div>
                      ) : (
                        d.issues.map((x) => (
                          <div key={x.id} className="flex items-center gap-2 text-sm">
                            <span className="font-mono tabular-nums text-muted-foreground">
                              #{x.id}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{x.title}</span>
                            <span className="text-muted-foreground">{x.kind}</span>
                            {x.outcome === 'dropped' ? (
                              <Lozenge tone="neutral">Dropped</Lozenge>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          />
        </div>
      </div>
    </Page>
  )
}
