import { text } from '@tanstack/charts/text'
import type { Empty, FootFacts, Phase, Verdict } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { useFormat } from 'basalt-ui'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { N63_SERIES } from '../../../demo/series'
import { HIGH_ABOVE, ZONES, type Morning, type Sample } from './fixture'

const GROUP = 'n63-day'
const GUTTER = 44
const MINUS = '\u2212'
const HOUR_MS = 3_600_000

/** The two measures' names: chart names, axis titles, announcement and footer read them from here. */
const N = { stress: 'Stress', battery: 'Battery' }

const signed = (n: number): string => (n < 0 ? MINUS + String(-n) : n > 0 ? '+' + String(n) : '0')

const sentence = (...parts: readonly (string | number)[]): string => parts.join(' ')

const zoneName = (stress: number): string =>
  stress > HIGH_ABOVE ? 'high' : stress > ZONES[1] ? 'medium' : stress > ZONES[0] ? 'low' : 'rest'

const extreme = (
  rows: readonly Sample[],
  pick: (s: Sample) => number,
  sign: 1 | -1,
): Sample | undefined =>
  rows.reduce<Sample | undefined>(
    (best, s) => (best === undefined || sign * pick(s) > sign * pick(best) ? s : best),
    undefined,
  )

type Props = {
  morning: Morning
  phase: Phase
  empty: Empty | null
}

export function StressCard({ morning, phase, empty }: Props) {
  const fmt = useFormat()
  const { samples, asleep, high } = morning
  const clock = (d: Date): string =>
    fmt.time(d, { hour: '2-digit', minute: '2-digit', hour12: false })
  const ready = phase === 'ready' && empty === null

  const focus = useChartFocus(samples, {
    announce: (s) =>
      sentence(
        clock(s.at) + ':',
        N.stress,
        s.stress + ',',
        zoneName(s.stress) + ';',
        N.battery,
        s.battery + '%',
      ),
  })

  const first = samples[0]
  const now = samples.at(-1)
  const peak = extreme(samples, (s) => s.stress, 1)
  const low = extreme(samples, (s) => s.battery, -1)
  const highHours = high === null ? 0 : (high.to.getTime() - high.from.getTime()) / HOUR_MS
  const asleepHours = asleep === null ? 0 : (asleep.to.getTime() - asleep.from.getTime()) / HOUR_MS
  const overLabel = `${highHours} h over 75`
  const restStatus: Verdict =
    high === null
      ? { tone: 'neutral', label: 'Under 75 all day' }
      : { tone: 'bad', label: overLabel }

  const figure =
    ready && now !== undefined && low !== undefined && first !== undefined
      ? {
          value: now.battery,
          unit: '%',
          delta: {
            value: signed(now.battery - low.battery),
            polarity: now.battery === low.battery ? ('neutral' as const) : ('up-good' as const),
            label: 'since its low',
          },
          status: focus.readout(restStatus, (s): Verdict => ({
            tone: s.stress > HIGH_ABOVE ? 'bad' : 'neutral',
            label: sentence(N.stress, s.stress + ',', zoneName(s.stress)),
          })),
          period: focus.readout(
            clock(first.at) + ' to ' + clock(now.at),
            (s) => clock(s.at) + ', ' + N.battery.toLowerCase() + ' ' + s.battery + '%',
          ),
          periodMono: true,
        }
      : {
          value: null,
          unit: '%',
          delta: undefined,
          status: undefined,
          period: '',
          periodMono: true,
        }

  const footer: FootFacts = [
    {
      label: ready && peak !== undefined ? 'Peak ' + peak.stress : 'Peak',
      value: ready && peak !== undefined ? clock(peak.at) : '',
      mono: true,
    },
    {
      label: ready && low !== undefined ? 'Low ' + low.battery : 'Low',
      value: ready && low !== undefined ? clock(low.at) : '',
      mono: true,
    },
  ]

  // Three-hourly ticks on whole clock hours, the last one before the right edge.
  const hourTicks = Array.from({ length: 8 }, (_, i) => new Date(Date.UTC(2026, 10, 19, 9 + 3 * i)))
  const bottomX = {
    value: (s: Sample) => s.at,
    ticks: hourTicks,
    format: (v: number | Date | string) => clock(new Date(v)),
  }
  const topX = { value: (s: Sample) => s.at, ticks: [] as Date[], format: bottomX.format }

  const asleepZone = (label?: string) =>
    asleep === null
      ? []
      : [
          {
            axis: 'x' as const,
            from: asleep.from,
            to: asleep.to,
            fill: alpha(BASALT.inkMuted, 0.08),
            ...(label === undefined ? {} : { label }),
          },
        ]

  return (
    <ChartCard
      title="Stress and body battery"
      subtitle="Past 24 hours, every 3 minutes"
      info="Energy left for the day. Sleep recharges it; activity and strain drain it."
      phase={phase}
      empty={empty}
      height="fill"
      figure={figure}
      footer={footer}
      chart={() => (
        <div className="flex flex-col">
          <div>
            <CartesianChart
              label={N.stress}
              data={samples}
              x={topX}
              y={{ domain: [0, 100], gutter: GUTTER, title: N.stress }}
              cursor={GROUP}
              focus={focus}
              tooltip={false}
              height={420}
              series={[
                {
                  mark: 'line',
                  key: 'stress',
                  label: N.stress,
                  color: N63_SERIES.stress,
                  y: (s) => s.stress,
                  format: (v) => String(v),
                },
              ]}
              refLines={ZONES.map((z) => ({
                value: z,
                color: N63_SERIES.rule,
                dashed: true,
                label: z === HIGH_ABOVE ? 'High from 75' : String(z),
              }))}
              zones={[
                ...asleepZone(),
                ...(high === null
                  ? []
                  : [
                      {
                        axis: 'x' as const,
                        from: high.from,
                        to: high.to,
                        y: { from: HIGH_ABOVE, to: 100 },
                        fill: alpha(BASALT.bad, 0.16),
                        label: overLabel,
                      },
                    ]),
              ]}
            />
          </div>
          <div>
            <CartesianChart
              label={N.battery}
              data={samples}
              x={bottomX}
              y={{ domain: [0, 100], gutter: GUTTER, title: N.battery + ', %' }}
              cursor={GROUP}
              tooltip={false}
              height={300}
              series={[
                {
                  mark: 'line',
                  key: 'battery',
                  label: N.battery,
                  color: N63_SERIES.battery,
                  y: (s) => s.battery,
                  format: (v) => v + '%',
                },
              ]}
              zones={asleepZone(
                asleep === null ? undefined : 'Asleep ' + Math.round(asleepHours * 10) / 10 + ' h',
              )}
              marks={CartesianChart.custom<Sample>(() => {
                if (low === undefined) return []
                // cycle-expression-14: chartLabels.place dropped this label at the plot's bottom edge, so it sits at a fixed offset.
                return [
                  text([low], {
                    x: (s) => s.at,
                    y: (s) => s.battery,
                    text: (s) => 'Low ' + s.battery,
                    dx: -8,
                    dy: 7,
                    anchor: 'end',
                    fill: BASALT.ink,
                    fontSize: BASALT.text.micro,
                  }),
                ]
              })}
            />
          </div>
        </div>
      )}
    />
  )
}
