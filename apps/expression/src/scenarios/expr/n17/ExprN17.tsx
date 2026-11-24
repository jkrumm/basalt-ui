import { useMemo } from 'react'
import type { ReactElement } from 'react'
import { text } from '@tanstack/charts/text'
import { useFormat } from 'basalt-ui'
import { BarList } from 'basalt-ui/cards'
import { CardGrid, Page } from 'basalt-ui/page'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { BASALT } from 'basalt-ui/tokens'
import { MEM_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { CORES, LIMIT, SWAP_GB, TOTAL_GB, hostMemory } from './fixture'
import type { Sample } from './fixture'

const gb = (n: number): string => `${n.toFixed(1)} GB`
const pct = (n: number): string => `${Math.round(n)}`

const statusFor = (pressure: number) =>
  pressure >= LIMIT
    ? { tone: 'bad' as const, label: `${Math.round(pressure - LIMIT)} pts over the limit` }
    : { tone: 'neutral' as const, label: `${Math.round(LIMIT - pressure)} pts under the limit` }

export function ExprN17Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const f = useFormat()
  const { samples, classes } = useMemo(() => hostMemory(fixture), [fixture])
  const rows: readonly Sample[] = shotState === 'empty' || shotState === 'loading' ? [] : samples
  const phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? ({
            tag: 'error',
            message: 'The host agent did not answer.',
            retry: () => window.location.reload(),
          } as const)
        : 'ready'
  // Every declaration stays in every phase; only a ready card carries the day's numbers, else a dash.
  const live = shotState === undefined
  const now = live ? samples.at(-1) : undefined
  const over = samples.filter((s) => s.pressure >= LIMIT).length
  const peak = samples.reduce((a, b) => (b.pressure > a.pressure ? b : a), samples[0]!)
  const clock = (s: Sample): string => f.time(s.at, { hour: '2-digit', minute: '2-digit' })
  const stamp = (s: Sample): string => `${f.date(s.at, 'short')} ${clock(s)}`

  const focus = useChartFocus(rows, {
    announce: (s) =>
      `${stamp(s)}: pressure ${pct(s.pressure)}%, swap ${gb(s.swap)}, load ${s.load}`,
  })

  const sorted = shotState === 'empty' ? [] : [...classes].sort((a, b) => b.gb - a.gb)
  const held = sorted.reduce((sum, c) => sum + c.gb, 0)

  const figure = now
    ? {
        value: focus.readout(pct(now.pressure), (s) => pct(s.pressure)),
        unit: '%',
        status: focus.readout(statusFor(now.pressure), (s) => statusFor(s.pressure)),
        period: focus.readout('', stamp),
      }
    : { value: null }

  return (
    <Page area="expr-n17">
      <CardGrid min="regular">
        <ChartCard
          title="Memory pressure"
          subtitle="Last 24 h, one sample a minute"
          phase={phase}
          empty={
            shotState === 'empty'
              ? {
                  cause:
                    'No pressure samples in the last 24 h. Check that the host agent is running.',
                }
              : null
          }
          figure={figure}
          footer={[
            {
              label: 'Swap',
              value: now
                ? focus.readout(
                    `${now.swap.toFixed(1)} of ${SWAP_GB} GB`,
                    (s) => `${s.swap.toFixed(1)} of ${SWAP_GB} GB`,
                  )
                : '-',
            },
            {
              label: 'Load',
              value: now
                ? focus.readout(
                    `${now.load} of ${CORES} cores`,
                    (s) => `${s.load} of ${CORES} cores`,
                  )
                : '-',
            },
          ]}
          chart={() => (
            <CartesianChart
              ariaLabel="Memory pressure against its limit, one sample a minute for 24 hours"
              data={rows}
              x={{ value: (s) => s.at }}
              y={{ title: 'Pressure, %', domain: [0, 100] }}
              series={[
                {
                  mark: 'line',
                  key: 'pressure',
                  label: 'Pressure',
                  legend: false,
                  color: MEM_SERIES.pressure,
                  y: (s) => s.pressure,
                  format: (v) => `${pct(v)}%`,
                },
              ]}
              focus={focus}
              marks={CartesianChart.custom<Sample>((plot) => {
                if (over === 0) return []
                // cycle-expression-5: the kit lacked a named-mark seam on a line, so the peak note is a text mark placed by hand.
                const { placed } = chartLabels.place(
                  [
                    {
                      key: 'peak',
                      text: `${over} min over the limit`,
                      x: plot.x(peak.at) ?? 0,
                      y: plot.y(peak.pressure),
                    },
                  ],
                  { width: plot.plotWidth, height: plot.plotHeight },
                )
                return [
                  text(placed, {
                    x: () => peak.at,
                    y: () => peak.pressure,
                    text: (l) => l.text,
                    dx: (l) => l.dx,
                    dy: (l) => l.dy,
                    anchor: (l) => l.textAnchor,
                    fill: plot.focused === null ? BASALT.ink : BASALT.inkFaint,
                    fontSize: BASALT.text.micro,
                  }),
                ]
              })}
              refLines={[
                { value: LIMIT, color: MEM_SERIES.limit, dashed: true, label: `Limit ${LIMIT}%` },
              ]}
            />
          )}
        />
        <BarList
          title="Resident memory by process class"
          subtitle={`of ${TOTAL_GB} GB`}
          phase={phase}
          empty={
            shotState === 'empty' ? { cause: 'No process classes reported for this host.' } : null
          }
          items={[
            ...sorted.map((c) => ({ label: c.label, value: c.gb })),
            ...(held > 0 ? [{ label: 'Free', value: Math.max(0, TOTAL_GB - held) }] : []),
          ]}
          max={TOTAL_GB}
          rows={5}
          format={gb}
        />
      </CardGrid>
    </Page>
  )
}
