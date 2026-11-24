import { text } from '@tanstack/charts/text'
import { createFormat } from 'basalt-ui'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import type { ChartPlot, Series } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { BASALT, alpha } from 'basalt-ui/tokens'
import type { ReactElement } from 'react'
import { LOAD_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { BAND, DAY_NAMES, trainingLog } from './fixture'
import type { Day, Week } from './fixture'

const fmt = createFormat()
const noop = (): void => {}

type Note = { key: string; text: string; at: string; value: number }

/**
 * Direct labels on a band axis, placed in plot pixels clear of the bars.
 * cycle-expression-5: the kit has no bar annotation, so the label geometry and the bar boxes
 * the labels must clear are written here (a bar is assumed 70% of its band wide).
 */
function noteMarks<D>(plot: ChartPlot<D>, notes: readonly Note[], bands: number) {
  const half = (plot.plotWidth / bands) * 0.35
  const boxes = plot.data.length === 0 ? [] : notes.flatMap((n) => barBox(plot, n, half))
  const { placed } = chartLabels.place(
    notes.flatMap((n) => {
      const x = plot.x(n.at)
      return x === null
        ? []
        : [
            {
              key: n.key,
              text: n.text,
              x,
              y: plot.y(n.value),
              spots: ['above' as const, 'above-left' as const, 'above-right' as const],
            },
          ]
    }),
    { width: plot.plotWidth, height: plot.plotHeight },
    { obstacles: boxes, gap: 4 },
  )
  const byKey = new Map(notes.map((n) => [n.key, n]))
  return [
    text(placed, {
      x: (l) => byKey.get(l.key)?.at ?? '',
      y: (l) => byKey.get(l.key)?.value ?? 0,
      text: (l) => l.text,
      dx: (l) => l.dx,
      dy: (l) => l.dy,
      anchor: (l) => l.textAnchor,
      fill: BASALT.ink,
      fontSize: BASALT.text.micro,
    }),
  ]
}

function barBox<D>(plot: ChartPlot<D>, n: Note, half: number) {
  const x = plot.x(n.at)
  if (x === null) return []
  const top = plot.y(n.value)
  return [{ left: x - half, top, width: 2 * half, height: plot.plotHeight - top }]
}

type Verdict = 'In band' | 'Over band' | 'Under band'

const verdictOf = (total: number): Verdict =>
  total > BAND.to ? 'Over band' : total < BAND.from ? 'Under band' : 'In band'

/** The distance to the nearest edge that matters, said once on the mark. */
function distance(total: number): string {
  if (total > BAND.to) return `${fmt.number(total - BAND.to)} over the top`
  if (total < BAND.from) return `${fmt.number(BAND.from - total)} under the floor`
  return `${fmt.number(BAND.to - total)} under the top`
}

const weekSeries: Series<Week>[] = [
  {
    mark: 'bar',
    key: 'past',
    label: 'Past weeks',
    color: LOAD_SERIES.past,
    y: (w) => (w.current || verdictOf(w.total) !== 'In band' ? null : w.total),
    format: (v) => `${fmt.number(v)} AU`,
  },
  {
    mark: 'bar',
    key: 'out',
    label: 'Left the band',
    color: LOAD_SERIES.out,
    y: (w) => (w.current || verdictOf(w.total) === 'In band' ? null : w.total),
    format: (v) => `${fmt.number(v)} AU`,
  },
  {
    mark: 'bar',
    key: 'done',
    label: 'Done',
    color: LOAD_SERIES.done,
    y: (w) => (w.current ? w.done : null),
    format: (v) => `${fmt.number(v)} AU`,
  },
  {
    mark: 'bar',
    key: 'planned',
    label: 'Planned',
    color: LOAD_SERIES.planned,
    opacity: () => 0.4,
    y: (w) => (w.current ? w.planned : null),
    format: (v) => `${fmt.number(v)} AU`,
  },
]

const daySeries: Series<Day>[] = [
  {
    mark: 'bar',
    key: 'done',
    label: 'Done',
    color: LOAD_SERIES.done,
    y: (d) => (d.state === 'done' ? d.load : null),
    format: (v) => `${fmt.number(v)} AU`,
  },
  {
    mark: 'bar',
    key: 'planned',
    label: 'Planned',
    color: LOAD_SERIES.planned,
    opacity: () => 0.4,
    y: (d) => (d.state === 'planned' ? d.load : null),
    format: (v) => `${fmt.number(v)} AU`,
  },
]

export function ExprN03Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const { days, weeks } = trainingLog(fixture)
  const current = weeks[weeks.length - 1]
  const past = weeks.slice(0, -1)
  const average = Math.round(past.reduce((sum, w) => sum + w.total, 0) / past.length)
  const thisWeek = days.filter((d) => d.week === current?.label)
  const ahead = thisWeek.filter((d) => d.state === 'planned')
  const sessionsLeft = ahead.filter((d) => d.load > 0)
  const heaviest = thisWeek.reduce<Day | undefined>(
    (top, d) => (top === undefined || d.load > top.load ? d : top),
    undefined,
  )

  const weekFocus = useChartFocus(weeks, {
    announce: (w) => `Week of ${w.label}: ${fmt.number(w.total)} AU, ${verdictOf(w.total)}`,
  })
  const dayFocus = useChartFocus(thisWeek, {
    announce: (d) => `${d.day}: ${d.session}, ${fmt.number(d.load)} AU, ${d.state}`,
  })

  const phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error' as const, retry: noop, message: 'The training log did not respond.' }
        : 'ready'
  const empty =
    shotState === 'empty'
      ? {
          cause: 'No sessions are logged or planned yet.',
          action: { label: 'Log a session', onClick: noop },
        }
      : null

  if (current === undefined || heaviest === undefined) return <PageBar title="Training load" />

  const statusOf = (total: number, isCurrent: boolean) => ({
    tone: isCurrent && verdictOf(total) !== 'In band' ? ('warn' as const) : ('neutral' as const),
    label: verdictOf(total),
  })
  const deltaOf = (total: number) => ({
    value: fmt.percent((total - average) / average, {
      signDisplay: 'exceptZero',
      maximumFractionDigits: 0,
    }),
    polarity: 'neutral' as const,
    label: 'vs 8-week avg',
  })

  const lastKey = current.label
  const blank = shotState === 'loading' || shotState === 'empty' || shotState === 'error'
  const dash = '\u2014'
  const dayNotes: Note[] =
    heaviest.load === 0
      ? [{ key: 'none', text: 'No load this week', at: 'Thu', value: 0 }]
      : ahead.map((d) => ({
          key: d.day,
          text: d.load === 0 ? 'Rest' : d.session,
          at: d.day,
          value: d.load,
        }))

  return (
    <Page area="expr-n03">
      <PageBar title="Training load, last 9 weeks" />
      <CardGrid min="regular">
        <ChartCard
          title="Weekly load"
          subtitle="Per Monday to Sunday week"
          phase={phase}
          empty={empty}
          legend={[
            {
              key: 'band',
              label: `Target ${fmt.number(BAND.from)} to ${fmt.number(BAND.to)}`,
              color: LOAD_SERIES.average,
              swatch: 'hollow',
            },
            {
              key: 'avg',
              label: `8-week average ${fmt.number(average)}`,
              color: LOAD_SERIES.average,
              swatch: 'dashed',
            },
          ]}
          figure={
            blank
              ? { value: null, unit: 'AU' }
              : {
                  // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n03, kept as its builder left it: its figure follows focus, built before figure-readout
                  value: weekFocus.readout(current.total, (w) => w.total),
                  unit: 'AU',
                  status: weekFocus.readout(statusOf(current.total, true), (w) =>
                    statusOf(w.total, w.current),
                  ),
                  // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n03, kept as its builder left it: its figure follows focus, built before figure-readout
                  delta: weekFocus.readout(deltaOf(current.total), (w) => deltaOf(w.total)),
                  period: weekFocus.readout(`planned, ${distance(current.total)}`, (w) =>
                    w.current
                      ? `planned, ${distance(w.total)}`
                      : `week of ${w.label}, ${distance(w.total)}`,
                  ),
                }
          }
          footer={[
            { label: 'Done Mon to Thu', value: blank ? dash : fmt.number(current.done) },
            { label: 'Still planned', value: blank ? dash : fmt.number(current.planned) },
          ]}
          chart={() => (
            <CartesianChart
              label="Weekly training load over nine weeks against the target band"
              summary={`This week ${fmt.number(current.total)} AU planned, ${distance(current.total)}; the eight-week average is ${fmt.number(average)} AU.`}
              data={weeks}
              focus={weekFocus}
              x={{
                value: (w) => w.label,
                // cycle-expression-5: a band key that reads as a date is printed with its year; the format pins the short form.
                format: (x) => String(x).replace(/, \d{4}$/, ''),
                ticks: weeks.filter((_, i) => i % 2 === 0).map((w) => w.label),
              }}
              y={{
                title: 'Load, AU',
                domain: {
                  floor: 0,
                  ceil: Math.max(BAND.to, ...weeks.map((w) => w.total)),
                  pad: 0.1,
                },
              }}
              series={weekSeries}
              zones={[
                {
                  axis: 'x',
                  from: weeks[0]?.label ?? '',
                  to: lastKey,
                  y: BAND,
                  fill: alpha(BASALT.ink, 0.06),
                },
              ]}
              refLines={[
                {
                  value: average,
                  color: LOAD_SERIES.average,
                  dashed: true,
                },
              ]}
            />
          )}
        />
        <ChartCard
          title="This week by day"
          subtitle="Per day, solid is done"
          phase={phase}
          empty={empty}
          figure={
            blank
              ? { value: null, unit: 'AU' }
              : {
                  // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n03, kept as its builder left it: its figure follows focus, built before figure-readout
                  value: dayFocus.readout(heaviest.load, (d) => d.load),
                  unit: 'AU',
                  period: dayFocus.readout(
                    heaviest.load === 0 ? 'no load this week' : 'heaviest day',
                    (d) =>
                      d.load === 0
                        ? `${d.day}, ${d.session}`
                        : `${d.day}, ${d.session} (${d.state})`,
                  ),
                }
          }
          footer={[
            { label: 'Sessions left', value: blank ? dash : sessionsLeft.length },
            { label: 'Rest days left', value: blank ? dash : ahead.length - sessionsLeft.length },
          ]}
          chart={() => (
            <CartesianChart
              label="Training load per day this week, done and planned"
              data={thisWeek}
              focus={dayFocus}
              x={{ value: (d) => d.day, ticks: [...DAY_NAMES] }}
              y={{
                title: 'Load, AU',
                domain: { floor: 0, ceil: Math.max(500, heaviest.load), pad: 0.15 },
              }}
              series={daySeries}
              marks={CartesianChart.custom<Day>((plot) => noteMarks(plot, dayNotes, 7))}
            />
          )}
        />
      </CardGrid>
    </Page>
  )
}
