import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import type { ChartFigure } from 'basalt-ui/charts'
import { useFormat } from 'basalt-ui'
import type { Phase } from 'basalt-ui/cards'
import { BASALT } from 'basalt-ui/tokens'
import { text } from '@tanstack/charts/text'
import { Page, PageBar } from 'basalt-ui/page'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import type { ReactElement } from 'react'
import { LINE_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { EMPTY_LOG, FULL_LOG, QUIET_LOG, median } from './fixture'
import type { Handling, Outage } from './fixture'

const CAP_MINUTES = 45
const DAY = 86_400_000
const NOTHING = (): undefined => undefined

const SERIES_META: readonly { key: Handling; label: string }[] = [
  { key: 'rebooted', label: 'Rebooted' },
  { key: 'other', label: 'Cable or port' },
  { key: 'alone', label: 'Left alone' },
]

export function ExprN21Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const fmt = useFormat()
  const log =
    shotState === 'empty' || shotState === 'loading' || shotState === 'error'
      ? EMPTY_LOG
      : fixture === 'quiet'
        ? QUIET_LOG
        : FULL_LOG
  const outages = log.outages
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The line monitor did not answer.', retry: NOTHING }
        : 'ready'

  const day = (d: Date): string => fmt.date(d, 'short')
  const read = (o: Outage): string => `${day(o.start)}, ${o.minutes} min: ${o.what}`
  const focus = useChartFocus(outages, { announce: read })

  const aloneMedian = median(outages.filter((o) => o.held).map((o) => o.minutes))
  const rebootedMedian = median(
    outages.filter((o) => o.handling === 'rebooted').map((o) => o.minutes),
  )
  const rebootedCount = outages.filter((o) => o.handling === 'rebooted').length
  const gap = rebootedMedian === null || aloneMedian === null ? null : rebootedMedian - aloneMedian

  const rest: ChartFigure =
    outages.length === 0
      ? { value: '—' }
      : rebootedMedian === null
        ? { value: 0, unit: 'reboots', period: 'none ran during a drop' }
        : {
            value: `${rebootedMedian} min`,
            period: 'median down, rebooted drops',
            ...(gap === null
              ? {}
              : {
                  delta: {
                    value: `${gap > 0 ? '+' : ''}${gap} min`,
                    polarity: gap === 0 ? ('neutral' as const) : ('up-bad' as const),
                    label: 'vs held back',
                  },
                }),
          }
  const figure: ChartFigure = {
    value: focus.readout(rest.value, (o) => `${o.minutes} min`),
    ...(focus.datum === null && rest.unit !== undefined ? { unit: rest.unit } : {}),
    ...(focus.datum === null && rest.delta !== undefined ? { delta: rest.delta } : {}),
    ...(rest.period === undefined
      ? {}
      : { period: focus.readout(rest.period, (o) => `${day(o.start)}: ${o.what}`) }),
  }
  const first = outages[0]?.start.getTime() ?? 0
  const last = outages[outages.length - 1]?.start.getTime() ?? 0
  const longest = outages.reduce<Outage | null>(
    (m, o) => (o.minutes > CAP_MINUTES && (m === null || o.minutes > m.minutes) ? o : m),
    null,
  )

  return (
    <Page area="expr-n21">
      <PageBar title="Router drops and what we did" />
      <div className="@container flex flex-col gap-4">
        <div className="grid gap-4 @wide:grid-cols-2">
          <ChartCard
            title="Reboots and drops"
            subtitle={
              outages.length === 0 ? 'Six months of drops' : `${outages.length} drops in six months`
            }
            phase={phase}
            empty={
              shotState === 'empty'
                ? {
                    cause:
                      'No drops are logged for the last six months. Check that the line monitor is running, or wait for the next drop.',
                  }
                : null
            }
            figure={figure}
            footer={[
              {
                label: 'Held back',
                value: aloneMedian === null ? '—' : `${aloneMedian} min median`,
              },
              {
                label: 'Rebooted',
                value: outages.length === 0 ? '—' : `${rebootedCount} of ${outages.length} drops`,
              },
            ]}
            chart={() => (
              <CartesianChart
                label="Minutes the line stayed down, for each drop"
                data={outages}
                focus={focus}
                x={{
                  value: (o) => o.start,
                  ticks: 6,
                  domain: [new Date(first - 6 * DAY), new Date(last + 6 * DAY)],
                }}
                y={{
                  title: 'Minutes down',
                  domain: ([, hi]) => [0, Math.min(hi, CAP_MINUTES)],
                }}
                series={SERIES_META.map(({ key, label }) => ({
                  mark: 'dot' as const,
                  key,
                  label,
                  color: LINE_SERIES[key],
                  y: (o: Outage) => (o.handling === key ? o.minutes : null),
                }))}
                refLines={
                  aloneMedian === null
                    ? []
                    : [
                        {
                          value: aloneMedian,
                          color: LINE_SERIES.median,
                          dashed: true,
                          label: `Held back: ${aloneMedian} min`,
                        },
                      ]
                }
                tooltip={false}
                marks={CartesianChart.custom<Outage>((plot) => {
                  const r = BASALT.dotR + 1
                  const dots = plot.rows('rebooted').concat(plot.rows('other'), plot.rows('alone'))
                  const obstacles = dots.map((o) => {
                    const px = plot.x(o.start) ?? 0
                    const py = plot.y(Math.min(o.minutes, CAP_MINUTES))
                    return { left: px - r, top: py - r, width: 2 * r, height: 2 * r }
                  })
                  const wanted: { key: string; text: string; at: Date; value: number }[] = []
                  if (longest !== null) {
                    wanted.push({
                      key: 'longest',
                      text: `${Math.round(longest.minutes / 60)} h, off scale`,
                      at: longest.start,
                      value: CAP_MINUTES,
                    })
                  }
                  if (aloneMedian !== null) {
                    wanted.push({
                      key: 'median',
                      text: `Held back: ${aloneMedian} min`,
                      at: new Date(first),
                      value: aloneMedian,
                    })
                  }
                  const { placed } = chartLabels.place(
                    wanted.map((w) => ({
                      key: w.key,
                      text: w.text,
                      x: plot.x(w.at) ?? 0,
                      y: plot.y(w.value),
                    })),
                    { width: plot.plotWidth, height: plot.plotHeight },
                    { obstacles, gap: BASALT.dotR + 3 },
                  )
                  const byKey = new Map(wanted.map((w) => [w.key, w]))
                  return [
                    text(placed, {
                      x: (l) => byKey.get(l.key)?.at ?? new Date(last),
                      y: (l) => byKey.get(l.key)?.value ?? 0,
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
          <div className="flex min-w-0 flex-col gap-2" onPointerLeave={focus.target.onPointerLeave}>
            <ScrollArea aria-label="Drops and what was done" className="max-h-96">
              {outages.map((o, i) => (
                <div
                  key={o.id}
                  {...focus.item(i)}
                  className="flex items-baseline gap-3 px-2 py-1 text-sm data-focused:bg-selected"
                >
                  <span className="font-mono tabular-nums">{day(o.start)}</span>
                  <span className="w-14 shrink-0 text-right font-mono tabular-nums">
                    {o.minutes} min
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-muted-foreground">
                    {o.what}
                  </span>
                </div>
              ))}
            </ScrollArea>
          </div>
        </div>
      </div>
    </Page>
  )
}
