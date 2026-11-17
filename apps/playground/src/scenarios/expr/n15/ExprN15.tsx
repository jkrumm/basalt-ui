import type { ReactElement } from 'react'
import { text } from '@tanstack/charts/text'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import type { ChartFigure } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { BASALT } from 'basalt-ui/tokens'
import { WALK_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { TARGET_MINUTES, isFixtureName, mmss, paceOf, walks } from './fixture'
import type { Week } from './fixture'

const DASH = '–'
const PLACEHOLDER_FIGURE: ChartFigure = {
  value: null,
  delta: { value: DASH, polarity: 'neutral' },
  period: DASH,
}

const signed = (n: number): string => `${n < 0 ? '-' : '+'}${Math.abs(n)}`
const weekOf = (w: Week): string => (w.partial ? `Week of ${w.key}, so far` : `Week of ${w.key}`)

/** The ready-phase facts of the two cards, computed from rows only once there are rows. */
function summarise(weeks: readonly Week[]) {
  const current = weeks[weeks.length - 1]
  const done = weeks.filter((w) => !w.partial)
  const hit = done.filter((w) => w.minutes >= TARGET_MINUTES).length
  const recent = weeks.slice(-4)
  const prior = weeks.slice(-8, -4)
  const paced = weeks.filter((w) => w.pace !== null)
  const best = paced.reduce<Week | null>(
    (b, w) => (b === null || (w.pace ?? Infinity) < (b.pace ?? Infinity) ? w : b),
    null,
  )
  const energies = recent.flatMap((w) => (w.energy === null ? [] : [w.energy]))
  return {
    current,
    hit,
    complete: done.length,
    recentPace: paceOf(recent),
    priorPace: paceOf(prior),
    best,
    energy:
      energies.length > 0
        ? Math.round((energies.reduce((a, b) => a + b, 0) / energies.length) * 10) / 10
        : null,
  }
}

export function ExprN15Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const data = walks(isFixtureName(fixture) ? fixture : undefined)
  const weeks = shotState === 'empty' ? [] : data.weeks
  const ready = shotState === undefined
  const focus = useChartFocus(weeks, {
    announce: (w) =>
      `${weekOf(w)}: ${w.minutes} min in ${w.sessions} walks${w.pace === null ? '' : `, pace ${mmss(w.pace)} per km`}`,
  })
  const phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? ({
            tag: 'error',
            message: 'The pad log did not answer.',
            retry: () => undefined,
          } as const)
        : 'ready'
  const empty =
    shotState === 'empty'
      ? {
          cause: 'No walks are logged in the last 8 weeks.',
          action: { label: 'Log a walk', onClick: () => undefined },
        }
      : null
  const s = ready ? summarise(weeks) : null

  const minutesFigure: ChartFigure =
    s === null || s.current === undefined
      ? PLACEHOLDER_FIGURE
      : {
          value: focus.readout(String(s.current.minutes), (w) => String(w.minutes)),
          unit: 'min',
          delta: focus.readout(
            {
              value: `${signed(s.current.minutes - TARGET_MINUTES)} min`,
              polarity: 'up-good' as const,
              label: 'to target',
            },
            (w) => ({
              value: `${signed(w.minutes - TARGET_MINUTES)} min`,
              polarity: 'up-good' as const,
              label: 'to target',
            }),
          ),
          period: focus.readout(weekOf(s.current), weekOf),
        }

  const paceDelta = (
    pace: number | null,
    base: number | null,
    label: string,
  ): NonNullable<ChartFigure['delta']> =>
    pace === null || base === null
      ? { value: DASH, polarity: 'neutral' }
      : {
          value: `${pace - base < 0 ? '-' : '+'}${mmss(pace - base)}`,
          polarity: 'up-bad',
          label,
        }
  const paceFigure: ChartFigure =
    s === null
      ? PLACEHOLDER_FIGURE
      : {
          value: focus.readout(s.recentPace === null ? DASH : mmss(s.recentPace), (w) =>
            w.pace === null ? DASH : mmss(w.pace),
          ),
          unit: 'min/km',
          delta: focus.readout(paceDelta(s.recentPace, s.priorPace, 'vs prior 4 weeks'), (w) =>
            paceDelta(w.pace, s.priorPace, 'vs prior 4 weeks'),
          ),
          period: focus.readout('last 4 weeks', weekOf),
        }

  return (
    <Page area="walking-pad">
      <PageBar title="Walking pad, last 8 weeks" />
      <CardGrid min="regular">
        <ChartCard
          title="Minutes walked per week"
          figure={minutesFigure}
          phase={phase}
          empty={empty}
          footer={[
            {
              label: 'Weeks on target',
              value: s === null ? DASH : `${s.hit} of ${s.complete}`,
            },
            {
              label: 'Walks',
              value:
                s === null || s.current === undefined
                  ? DASH
                  : focus.readout(s.current.sessions, (w) => w.sessions),
            },
          ]}
          chart={() => (
            <CartesianChart<Week>
              label="Minutes walked in each of the last 8 weeks against the weekly target"
              data={weeks}
              focus={focus}
              x={{ value: (w) => w.key, title: 'Week starting' }}
              y={{ title: 'Minutes', domain: { floor: 0, ceil: TARGET_MINUTES, pad: 0.1 } }}
              series={[
                {
                  mark: 'bar',
                  key: 'minutes',
                  label: 'Minutes',
                  color: WALK_SERIES.minutes,
                  y: (w) => w.minutes,
                  opacity: (w) => (w.partial ? 0.55 : 1),
                },
              ]}
              refLines={[
                {
                  value: TARGET_MINUTES,
                  color: WALK_SERIES.target,
                  dashed: true,
                  label: `Target ${TARGET_MINUTES} min`,
                },
              ]}
              marks={CartesianChart.custom<Week>((plot) => {
                const rows = plot.rows('minutes')
                const top = rows.reduce<Week | null>(
                  (b, w) => (b === null || w.minutes > b.minutes ? w : b),
                  null,
                )
                const named = rows.filter((w) => w.minutes === 0 || w === top)
                const { placed } = chartLabels.place(
                  named.flatMap((w) => {
                    const x = plot.x(w.key)
                    return x === null
                      ? []
                      : [
                          {
                            key: w.key,
                            text: w.minutes === 0 ? 'None' : String(w.minutes),
                            x,
                            y: plot.y(w.minutes),
                          },
                        ]
                  }),
                  { width: plot.plotWidth, height: plot.plotHeight },
                  { gap: 4 },
                )
                const byKey = new Map(rows.map((w) => [w.key, w]))
                return [
                  text(placed, {
                    x: (l) => l.key,
                    y: (l) => byKey.get(l.key)?.minutes ?? 0,
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
        <ChartCard
          title="Average pace per week"
          figure={paceFigure}
          phase={phase}
          empty={empty}
          footer={[
            {
              label: 'Best week',
              value:
                s?.best == null || s.best.pace === null
                  ? DASH
                  : `${mmss(s.best.pace)}, ${s.best.key}`,
            },
            {
              label: 'Energy, of 5',
              value:
                s === null || s.energy === null
                  ? DASH
                  : focus.readout(s.energy, (w) => w.energy ?? DASH),
            },
          ]}
          chart={() => (
            <CartesianChart<Week>
              label="Average pace in minutes per km for each of the last 8 weeks"
              data={weeks}
              focus={focus}
              x={{ value: (w) => w.key, title: 'Week starting' }}
              y={{
                title: 'Pace, min/km (lower is faster)',
                format: (v) => mmss(v),
                domain: ([lo, hi]) => [
                  Math.min(lo, s?.priorPace ?? lo) - 20,
                  Math.max(hi, s?.priorPace ?? hi) + 20,
                ],
              }}
              series={[
                {
                  mark: 'line',
                  key: 'pace',
                  label: 'Pace',
                  color: WALK_SERIES.pace,
                  y: (w) => w.pace,
                  format: (v) => `${mmss(v)} min/km`,
                },
              ]}
              refLines={
                s?.priorPace == null
                  ? []
                  : [
                      {
                        value: s.priorPace,
                        color: WALK_SERIES.target,
                        dashed: true,
                        label: `Prior 4 weeks ${mmss(s.priorPace)}`,
                      },
                    ]
              }
            />
          )}
        />
      </CardGrid>
    </Page>
  )
}
