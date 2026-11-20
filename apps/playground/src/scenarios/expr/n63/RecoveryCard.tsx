import { text } from '@tanstack/charts/text'
import type { Empty, FootFacts, Phase, Verdict } from 'basalt-ui/cards'
import {
  Bars,
  CartesianChart,
  ChartCard,
  Lines,
  chartLabels,
  useChartFocus,
} from 'basalt-ui/charts'
import { useFormat } from 'basalt-ui'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { N63_SERIES } from '../../../demo/series'
import { PUSH_FROM, REST_BELOW, type Day } from './fixture'

const GROUP = 'n63-days'
const GUTTER = 44
const MINUS = '\u2212'
const HOUR_MS = 3_600_000

/** Each measure's one name: the card title, chart names, axis titles and the announcement read it from here. */
const N = {
  recovery: 'Recovery score',
  hrv: 'HRV',
  sleep: 'Sleep',
  rhr: 'Resting heart rate',
}
const NO_SLEEP = 'No sleep logged'

const signed = (n: number): string => (n < 0 ? MINUS + String(-n) : n > 0 ? '+' + String(n) : '0')

const sentence = (...parts: readonly (string | number | null)[]): string => parts.join(' ')

function verdictOf(recovery: number | null): Verdict {
  if (recovery === null) return { tone: 'neutral', label: 'Not scored' }
  if (recovery >= PUSH_FROM) return { tone: 'accent', label: 'Push day' }
  if (recovery < REST_BELOW) return { tone: 'bad', label: 'Rest day' }
  return { tone: 'neutral', label: 'Easy day' }
}

const mean = (values: readonly number[]): number =>
  values.reduce((sum, v) => sum + v, 0) / values.length

type Props = {
  days: readonly Day[]
  noSleepDays: readonly Date[]
  phase: Phase
  empty: Empty | null
}

export function RecoveryCard({ days, noSleepDays, phase, empty }: Props) {
  const fmt = useFormat()
  const date = (d: Date): string => fmt.date(d, 'short')
  const today = days.at(-1)
  const ready = phase === 'ready' && empty === null

  const focus = useChartFocus(days, {
    announce: (d) =>
      d.recovery === null
        ? sentence(date(d.at) + ':', NO_SLEEP)
        : sentence(
            date(d.at) + ':',
            N.recovery,
            d.recovery + ',',
            N.hrv,
            d.hrv,
            'ms,',
            N.sleep,
            d.sleep,
            'h,',
            N.rhr,
            d.rhr,
            'bpm',
          ),
  })

  const scored = days.flatMap((d) => (d.recovery === null ? [] : [d.recovery]))
  const prior = days.slice(0, -1).flatMap((d) => (d.recovery === null ? [] : [d.recovery]))
  const diff = today?.recovery == null ? null : Math.round(today.recovery - mean(prior))
  const rest = verdictOf(today?.recovery ?? null)

  const figure = ready
    ? {
        value: today?.recovery ?? null,
        unit: 'of 100',
        delta:
          diff === null
            ? undefined
            : {
                value: signed(diff),
                polarity: diff === 0 ? ('neutral' as const) : ('up-good' as const),
                label: 'vs 30-day average',
              },
        status: focus.readout(rest, (d) => verdictOf(d.recovery)),
        period: focus.readout(
          today?.recovery == null ? NO_SLEEP : sentence('Today,', date(today.at)),
          (d) => (d.recovery === null ? sentence(date(d.at) + ':', NO_SLEEP) : date(d.at)),
        ),
        periodMono: true,
      }
    : {
        value: null,
        unit: 'of 100',
        delta: undefined,
        status: undefined,
        period: '',
        periodMono: true,
      }

  const footer: FootFacts = [
    {
      label: 'Push days',
      value: ready ? `${scored.filter((v) => v >= PUSH_FROM).length} of ${scored.length}` : '',
    },
    {
      label: 'Rest days',
      value: ready ? `${scored.filter((v) => v < REST_BELOW).length} of ${scored.length}` : '',
    },
  ]

  // cycle-expression-14: the kit has no pane group, so the four panes on one x are a column of charts that name one cursor group, one gutter and fixed heights.
  const gapZone = (named: boolean) =>
    noSleepDays.map((at, i) => ({
      axis: 'x' as const,
      from: new Date(at.getTime() - 12 * HOUR_MS),
      to: new Date(at.getTime() + 12 * HOUR_MS),
      fill: alpha(BASALT.inkMuted, 0.1),
      ...(named && i === 0 ? { label: NO_SLEEP } : {}),
    }))
  const dayX = { value: (d: Day) => d.at, ticks: [] as Date[] }
  const bottomX = { value: (d: Day) => d.at }
  const fitTo = ([lo, hi]: readonly [number, number]): [number, number] => [
    Math.floor(lo - 4),
    Math.ceil(hi + 4),
  ]

  return (
    <ChartCard
      title={N.recovery}
      subtitle="Daily, over 30 days"
      info="How ready you are to train. Higher is better."
      phase={phase}
      empty={empty}
      height="fill"
      figure={figure}
      footer={footer}
      chart={() => (
        <div className="flex flex-col">
          <div>
            <CartesianChart
              label={N.recovery}
              data={days}
              x={dayX}
              y={{ domain: [0, 100], gutter: GUTTER }}
              cursor={GROUP}
              focus={focus}
              tooltip={false}
              height={250}
              series={[
                {
                  mark: 'line',
                  key: 'recovery',
                  label: N.recovery,
                  color: N63_SERIES.recovery,
                  weight: 'strong',
                  y: (d) => d.recovery,
                  format: (v) => String(v),
                },
                {
                  mark: 'dot',
                  key: 'today',
                  label: 'Today',
                  color: N63_SERIES.recovery,
                  legend: false,
                  y: (d) => (d === today ? d.recovery : null),
                },
              ]}
              refLines={[
                { value: PUSH_FROM, color: N63_SERIES.rule, dashed: true, label: 'Push from 70' },
                { value: REST_BELOW, color: N63_SERIES.rule, dashed: true, label: 'Rest under 40' },
              ]}
              zones={gapZone(true)}
              marks={CartesianChart.custom<Day>((plot) => {
                const v = today?.recovery
                if (today === undefined || v == null) return []
                const px = plot.x(today.at)
                if (px === null) return []
                const r = BASALT.dotR + 1
                const { placed } = chartLabels.place(
                  [
                    {
                      key: 'today',
                      text: `${v} today`,
                      x: px,
                      y: plot.y(v),
                      spots: ['left', 'below-left', 'above-left'],
                    },
                  ],
                  { width: plot.plotWidth, height: plot.plotHeight },
                  {
                    obstacles: [{ left: px - r, top: plot.y(v) - r, width: 2 * r, height: 2 * r }],
                    gap: BASALT.dotR + 3,
                  },
                )
                return [
                  text(placed, {
                    x: () => today.at,
                    y: () => v,
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
          </div>
          <div>
            <Lines
              label={N.hrv}
              data={days}
              x={dayX}
              y={{ gutter: GUTTER, title: N.hrv + ', ms', domain: fitTo }}
              cursor={GROUP}
              tooltip={false}
              height={140}
              series={[
                {
                  mark: 'line',
                  key: 'hrv',
                  label: N.hrv,
                  color: N63_SERIES.hrv,
                  y: (d) => d.hrv,
                  format: (v) => v + ' ms',
                },
              ]}
              zones={gapZone(false)}
            />
          </div>
          <div>
            <Bars
              label={N.sleep}
              data={days}
              x={dayX}
              y={{ gutter: GUTTER, title: N.sleep + ', h', domain: { floor: 0, ceil: 9 } }}
              cursor={GROUP}
              tooltip={false}
              height={140}
              series={[
                {
                  mark: 'bar',
                  key: 'sleep',
                  label: N.sleep,
                  color: N63_SERIES.sleep,
                  y: (d) => d.sleep,
                  format: (v) => v + ' h',
                },
              ]}
              zones={gapZone(false)}
            />
          </div>
          <div>
            <Lines
              label={N.rhr}
              data={days}
              x={bottomX}
              y={{ gutter: GUTTER, title: N.rhr + ', bpm', domain: fitTo }}
              cursor={GROUP}
              tooltip={false}
              height={180}
              series={[
                {
                  mark: 'line',
                  key: 'rhr',
                  label: N.rhr,
                  color: N63_SERIES.rhr,
                  y: (d) => d.rhr,
                  format: (v) => v + ' bpm',
                },
              ]}
              zones={gapZone(false)}
            />
          </div>
        </div>
      )}
    />
  )
}
