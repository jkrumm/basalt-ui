import { BarList, DataPanel } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, useChartFocus, type LegendEntry } from 'basalt-ui/charts'
import { useFormat } from 'basalt-ui'
import { BASALT } from 'basalt-ui/tokens'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import { text } from '@tanstack/charts/text'
import { useEffect, type ComponentProps } from 'react'
import { Page, useSizeClass } from 'basalt-ui/page'
import type { ScenarioProps } from '../../shot-state'
import {
  PRIOR_SHARE,
  SOURCES,
  buildDays,
  isSpike,
  median,
  resolveFixture,
  SPIKE_FACTOR,
  type Day,
} from './fixture'

// cycle-expression-3: `Phase` is not exported from any public subpath, so it is read off ChartCard's props
type Phase = NonNullable<ComponentProps<typeof ChartCard>['phase']>

const DAY_FORMAT: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: undefined }

const NEUTRAL = { light: BASALT.inkFaint, dark: BASALT.inkFaint }
const INK = { light: BASALT.ink, dark: BASALT.ink }
const ACCENT = { light: BASALT.brand, dark: BASALT.brand }

const EMPTY = {
  cause: 'No alerts were triaged in the last 30 days. Check that the SIEM export is connected.',
}

const phaseOf = (shotState: ScenarioProps['shotState']): Phase => {
  if (shotState === 'loading') return 'loading'
  if (shotState === 'error') return { tag: 'error', message: 'The triage API did not answer.' }
  return 'ready'
}

const rowId = (i: number) => `c13-day-${i}`

export function ExprC13Scenario({ shotState, fixture }: ScenarioProps) {
  const fmt = useFormat()
  const narrow = useSizeClass() === 'compact'
  const phase = phaseOf(shotState)
  const days: readonly Day[] = shotState === 'empty' ? [] : buildDays(resolveFixture(fixture))
  const hasDays = days.length > 0

  const closed = days.reduce((sum, d) => sum + d.closed, 0)
  const escalated = days.reduce((sum, d) => sum + d.escalated, 0)
  const base = Math.round(median(days.map((d) => d.escalated)))
  const share = closed + escalated === 0 ? 0 : closed / (closed + escalated)
  const points = Math.round((share - PRIOR_SHARE) * 100)
  const dayText = (d: Day) => fmt.date(d.date, 'short', DAY_FORMAT)
  const busiest = days.reduce<Day | null>(
    (m, d) => (m === null || d.escalated > m.escalated ? d : m),
    null,
  )

  const focus = useChartFocus(days, {
    announce: (d) => `${dayText(d)}: ${d.escalated} escalated, ${d.closed} closed automatically`,
  })

  // cycle-expression-3: the list does not follow the chart's focus on its own, so scroll the row into view
  const focusedIndex = focus.index
  useEffect(() => {
    if (focusedIndex === null) return
    document.getElementById(rowId(focusedIndex))?.scrollIntoView({ block: 'nearest' })
  }, [focusedIndex])

  const sources = SOURCES.map(({ key, label }) => {
    const value = days.reduce((sum, d) => sum + d.bySource[key], 0)
    return { label, value, secondary: closed === 0 ? '' : fmt.percent(value / closed) }
  }).toSorted((a, b) => b.value - a.value)

  const ranked = days
    .map((d, i) => ({ d, i }))
    .toSorted((a, b) => b.d.escalated - a.d.escalated || a.i - b.i)

  const peak = Math.max(0, ...days.map((d) => d.escalated))
  const topClosed = Math.max(0, ...days.map((d) => d.closed))
  const spikes = days.filter((d) => isSpike(d, base))
  const spikeRule = base * SPIKE_FACTOR
  const refLines =
    base === 0
      ? []
      : [
          { value: -base, color: INK, dashed: true },
          { value: -spikeRule, color: ACCENT, dashed: true },
        ]
  const legend: LegendEntry[] = [
    { key: 'closed', label: 'Closed automatically', color: NEUTRAL, swatch: 'bar' },
    ...(escalated === 0
      ? []
      : [{ key: 'normal', label: 'Escalated', color: INK, swatch: 'bar' as const }]),
    ...(spikes.length === 0
      ? []
      : [
          { key: 'spike', label: 'Spike day', color: ACCENT, swatch: 'bar' as const },
          {
            key: 'median',
            label: `Median ${fmt.number(base)}`,
            color: INK,
            swatch: 'dashed' as const,
          },
          {
            key: 'rule',
            label: `Spike line ${fmt.number(Math.ceil(spikeRule))}`,
            color: ACCENT,
            swatch: 'dashed' as const,
          },
        ]),
  ]

  const first = days[0]
  const last = days.at(-1)
  const ready = shotState === undefined
  const figure = !ready
    ? { value: null }
    : focus.datum === null
      ? {
          value: fmt.percent(share),
          delta: {
            value: points === 0 ? '0 pts' : `${points > 0 ? '+' : ''}${points} pts`,
            polarity: points === 0 ? ('neutral' as const) : ('up-good' as const),
            label: 'vs prior 30 days',
          },
        }
      : {
          value: fmt.number(focus.datum.escalated),
          unit: 'escalated',
          period: `${dayText(focus.datum)}, ${fmt.number(focus.datum.closed)} closed`,
        }

  return (
    <Page area="expr-c13">
      <div className="grid gap-4 @wide:grid-cols-3">
        <div className="grid @wide:col-span-2">
          <ChartCard
            title="Closed without a person"
            subtitle={first && last ? `${dayText(first)} to ${dayText(last)}` : '30 days'}
            phase={phase}
            empty={hasDays ? null : EMPTY}
            legend={legend}
            figure={figure}
            footer={
              ready
                ? [
                    { label: 'Closed', value: fmt.number(closed) },
                    { label: 'Escalated', value: fmt.number(escalated) },
                  ]
                : [
                    { label: 'Closed', value: '—' },
                    { label: 'Escalated', value: '—' },
                  ]
            }
            chart={(box) => (
              <CartesianChart
                label="Alerts closed automatically above the axis and escalated to a person below it, per day, last 30 days"
                data={days}
                x={{
                  value: (d) => d.date,
                  format: (v) => fmt.date(v instanceof Date ? v : new Date(v), 'short', DAY_FORMAT),
                }}
                height={box.height}
                y={{
                  title: 'Alerts per day',
                  domain: [-(peak + Math.round(topClosed / 5)), Math.ceil(topClosed / 100) * 100],
                }}
                focus={focus}
                refLines={refLines}
                tooltip={{ formatHeader: dayText }}
                series={[
                  {
                    mark: 'bar',
                    key: 'closed',
                    label: 'Closed automatically',
                    color: NEUTRAL,
                    legend: false,
                    y: (d) => d.closed,
                  },
                  {
                    mark: 'bar',
                    key: 'normal',
                    label: 'Escalated',
                    color: INK,
                    legend: false,
                    format: (v) => fmt.number(Math.abs(v)),
                    y: (d) => (isSpike(d, base) ? null : -d.escalated),
                  },
                  {
                    mark: 'bar',
                    key: 'spike',
                    label: 'Spike day',
                    color: ACCENT,
                    legend: false,
                    format: (v) => fmt.number(Math.abs(v)),
                    y: (d) => (isSpike(d, base) ? -d.escalated : null),
                  },
                ]}
                marks={CartesianChart.custom<Day>(() => {
                  // cycle-expression-3: no kit label for a bar; two engine text marks, date over value
                  const rows = narrow ? spikes.filter((d) => d === busiest) : spikes
                  return [
                    text(rows, {
                      x: (d: Day) => d.date,
                      y: (d: Day) => -d.escalated,
                      text: dayText,
                      dy: 12,
                      fontSize: BASALT.text.nano,
                      fill: BASALT.ink,
                    }),
                    text(rows, {
                      x: (d: Day) => d.date,
                      y: (d: Day) => -d.escalated,
                      text: (d: Day) => d.escalated,
                      dy: 24,
                      fontSize: BASALT.text.nano,
                      fill: BASALT.ink,
                    }),
                  ]
                })}
              />
            )}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <DataPanel
            title="Days by escalations"
            subtitle="30 days, most first"
            phase={phase}
            empty={hasDays ? null : { cause: 'Days appear with the first alert.' }}
            bodySize={{ rows: 6 }}
            body={() => (
              <ScrollArea
                aria-label="Days ranked by escalations"
                className="max-h-64"
                onPointerLeave={focus.target.onPointerLeave}
              >
                {ranked.map(({ d, i }) => (
                  <div
                    key={d.date.getTime()}
                    {...focus.item(i)}
                    id={rowId(i)}
                    className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-sm data-focused:bg-selected"
                  >
                    {/* oxlint-disable-next-line basalt/tw-off-law -- no kit part takes a day label in the accent tone; it marks the spike days the bars mark */}
                    <span className={isSpike(d, base) ? 'font-mono text-brand' : 'font-mono'}>
                      {dayText(d)}
                    </span>
                    <span className="tabular-nums">{fmt.number(d.escalated)}</span>
                  </div>
                ))}
              </ScrollArea>
            )}
          />
          <BarList
            title="Closed by source"
            subtitle="30 days"
            items={sources}
            bodyRows={5}
            phase={phase}
            empty={hasDays ? null : { cause: 'Sources appear with the first alert.' }}
            format={(v) => fmt.number(v)}
          />
        </div>
      </div>
    </Page>
  )
}
