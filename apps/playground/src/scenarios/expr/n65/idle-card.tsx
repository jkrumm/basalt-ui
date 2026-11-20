import type { Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, chartLabels } from 'basalt-ui/charts'
import type { ChartFocus } from 'basalt-ui/charts'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { useFormat } from 'basalt-ui'
import { text } from '@tanstack/charts/text'
import { N65_SERIES } from '../../../demo/series'
import type { Data, Day } from './fixture'
import { signed } from './summary'
import { OUTCOMES } from './week-cards'
import type { Summary } from './summary'

/** A day has 24 hours: the axis ends there, so no bar is ever clipped. */
const DAY_HOURS = 24

const oneDecimal = (n: number): string => (Math.round(n * 10) / 10).toString()

const hours = (n: number): string => `${oneDecimal(n)} h`

const firstDay = (data: Data, weekId: string): string =>
  data.days.find((d) => d.weekId === weekId)?.key ?? ''
const lastDay = (data: Data, weekId: string): string =>
  data.days.findLast((d) => d.weekId === weekId)?.key ?? ''

type Props = {
  data: Data | undefined
  summary: Summary | undefined
  phase: Phase
  focus: ChartFocus<Day>
}

/** Idle hours of every day, weekends paler, the extreme and zero days named, the most-dropped week tinted. */
export function IdleCard({ data, summary, phase, focus }: Props) {
  const f = useFormat()
  const figure = {
    value: summary ? oneDecimal(summary.idleNow) : null,
    unit: 'h a day',
    delta: {
      value: summary ? signed(Math.round((summary.idleNow - summary.idleBefore) * 10) / 10) : '',
      polarity: 'up-bad' as const,
      label: 'vs W46',
    },
    period: 'W47',
    periodMono: true,
    status: focus.readout(
      { tone: 'neutral' as const, label: summary ? 'Mon to Sun' : '' },
      (d) => ({
        tone: 'neutral' as const,
        label: `${f.date(d.day, 'short')}: ${hours(d.idle)}`,
      }),
    ),
  }
  const footer = [
    { label: 'Weekday mean', value: summary ? hours(summary.weekdayMean) : '' },
    { label: 'Weekend mean', value: summary ? hours(summary.weekendMean) : '' },
  ] as const
  return (
    <ChartCard
      title="Idle capacity per day"
      subtitle="Hours per day, weekends paler"
      phase={phase}
      empty={
        data?.days.length === 0
          ? {
              cause: 'No capacity has been logged yet. Hours an agent reports turn into bars.',
            }
          : null
      }
      figure={figure}
      footer={footer}
      height="fill"
      chart={() =>
        data && summary ? (
          <CartesianChart
            label="Capacity per day"
            data={data.days}
            cursor="days"
            x={{
              value: (d) => d.key,
              ticks: data.days.filter((d) => d.day.getUTCDay() === 1).map((d) => d.key),
              format: (key) => data.days.find((d) => d.key === key)?.weekId ?? '',
            }}
            y={{ title: 'Hours', domain: [0, DAY_HOURS] }}
            focus={focus}
            tooltip={false}
            zones={[
              {
                axis: 'x' as const,
                from: firstDay(data, summary.mostDropped.id),
                to: lastDay(data, summary.mostDropped.id),
                fill: alpha(BASALT.bad, 0.1),
              },
              ...(summary.zeroIdle
                ? [
                    {
                      axis: 'x' as const,
                      from: summary.zeroIdle.key,
                      to: summary.zeroIdle.key,
                      fill: alpha(BASALT.ink, 0.1),
                    },
                  ]
                : []),
            ]}
            series={[
              {
                mark: 'bar',
                key: 'idle',
                label: 'Idle',
                color: N65_SERIES.idle,
                y: (d) => d.idle,
                format: hours,
                opacity: (d) => (d.weekend ? 0.55 : 1),
              },
            ]}
            marks={CartesianChart.custom<Day>((plot) => {
              // cycle-expression-14: a zone label of one narrow band is dropped or sits beside it, so the day, the peak and the most-dropped week are named by hand.
              const week = plot.data.filter((d) => d.weekId === summary.mostDropped.id)
              const middle = week[Math.floor(week.length / 2)]
              const named = [
                {
                  key: summary.mostIdle.key,
                  text: hours(summary.mostIdle.idle),
                  hours: summary.mostIdle.idle,
                  priority: 3,
                },
                ...(summary.zeroIdle
                  ? [{ key: summary.zeroIdle.key, text: '0 h', hours: DAY_HOURS, priority: 2 }]
                  : []),
                ...(middle
                  ? [
                      {
                        key: middle.key,
                        text: `Most ${OUTCOMES[1]}`,
                        hours: DAY_HOURS,
                        priority: 1,
                      },
                    ]
                  : []),
              ]
              const byKey = new Map(named.map((n) => [n.key, n]))
              const { placed } = chartLabels.place(
                named.map((n) => ({
                  key: n.key,
                  text: n.text,
                  x: plot.x(n.key) ?? 0,
                  y: plot.y(n.hours),
                  priority: n.priority,
                  ...(n.hours === DAY_HOURS ? { spots: ['below' as const] } : {}),
                })),
                { width: plot.plotWidth, height: plot.plotHeight },
                { gap: BASALT.dotR + 3 },
              )
              return [
                text(placed, {
                  x: (l) => l.key,
                  y: (l) => byKey.get(l.key)?.hours ?? 0,
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
        ) : null
      }
    />
  )
}
