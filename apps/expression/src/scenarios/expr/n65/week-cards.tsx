import type { Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, chartLabels } from 'basalt-ui/charts'
import type { ChartFocus } from 'basalt-ui/charts'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { text } from '@tanstack/charts/text'
import { N65_SERIES } from '../../../demo/series'
import { CLASSES, commitTotal, ended } from './fixture'
import type { ClassKey, Data, Week } from './fixture'
import { leaderOf, signed } from './summary'
import type { Summary } from './summary'

const CLASS_LABEL: Readonly<Record<ClassKey, string>> = {
  gate: 'Gate',
  review: 'Review',
  spec: 'Spec',
  deploy: 'Deploy',
}

/** The most Issues one week's bar may reach before the kit clamps it and draws the off-scale caret. */
const ISSUE_CAP = 40

/** Issues above the tallest stack, so each total label sits above its bar. */
const HEADROOM = 6

const LABEL_LIFT = 8

/** Px a plot-top caption sits below the plot's top edge. */
const CAPTION_DROP = 8

export const OUTCOMES = ['done', 'dropped', 'cancelled', 'open'] as const

/** The four outcome counts of a week, for the announcement. */
/** A focused week's reading, led by its id. */
export const weekReading = (w: Week, reading: string): string => `${w.id}: ${reading}`

export const outcomeLine = (w: Week): string =>
  weekReading(w, OUTCOMES.map((k) => `${w[k]} ${k}`).join(', '))

const oneDecimal = (n: number): string => (Math.round(n * 10) / 10).toString()

const stillOpen = (n: number): string => `${n} still open`

type CardProps = {
  data: Data | undefined
  summary: Summary | undefined
  phase: Phase
  focus: ChartFocus<Week>
}

const weekX = { value: (w: Week) => w.id }

const issuePeak = (weeks: readonly Week[]): number =>
  Math.max(...weeks.map((w) => ended(w) + w.open))

/** Issues per week by how they ended; the answer to "done or dropped" is the stack. */
export function OutcomesCard({ data, summary, phase, focus }: CardProps) {
  const figure = {
    value: summary ? ended(summary.now) : null,
    unit: 'ended',
    delta: {
      value: summary ? signed(ended(summary.now) - ended(summary.before)) : '',
      polarity: 'up-good' as const,
      label: 'vs W46',
    },
    period: 'W47',
    periodMono: true,
    // The figure stays W47's; a focused week reads in the status, with its own week id.
    status: focus.readout(
      { tone: 'neutral' as const, label: summary ? stillOpen(summary.now.open) : '' },
      (w) => ({
        tone: 'neutral' as const,
        label: weekReading(
          w,
          `${ended(w)} ended, ${w.dropped} ${OUTCOMES[1]}, ${stillOpen(w.open)}`,
        ),
      }),
    ),
  }
  const footer = [
    { label: 'Most dropped', value: summary ? summary.mostDropped.id : '', mono: true },
    { label: 'Fewest open', value: summary ? summary.fewestOpen.id : '', mono: true },
  ] as const
  return (
    <ChartCard
      title="Issues by outcome"
      subtitle="How each Issue ended, W40 to W47"
      phase={phase}
      empty={
        data?.weeks.length === 0
          ? {
              cause: 'No Issue outcome yet. A merge, drop or cancel adds the first bar.',
            }
          : null
      }
      figure={figure}
      footer={footer}
      height="short"
      chart={() =>
        data ? (
          <CartesianChart
            label="Stacked outcomes"
            data={data.weeks}
            x={weekX}
            y={{
              title: 'Issues',
              domain: [0, Math.min(ISSUE_CAP, issuePeak(data.weeks) + HEADROOM)],
            }}
            marks={CartesianChart.custom<Week>((plot) => {
              // cycle-expression-14: a stacked bar has no per-segment label, so the answer's two segments are named by hand.
              const last = plot.data.at(-1)
              if (!last) return []
              const barWidth = plot.plotWidth / plot.data.length
              const bands = [
                [OUTCOMES[0], 0, last.done],
                [OUTCOMES[1], last.done, last.done + last.dropped],
              ] as const
              const segments = bands
                .map(([k, from, to]) => ({ text: `${to - from} ${k}`, from, to }))
                .filter((s) =>
                  chartLabels.fits(
                    s.text,
                    { width: barWidth * 0.8, height: plot.y(s.from) - plot.y(s.to) },
                    { size: BASALT.text.micro },
                  ),
                )
              return [
                text(segments, {
                  x: () => last.id,
                  y: (s) => (s.from + s.to) / 2,
                  text: (s) => s.text,
                  anchor: () => 'middle',
                  fill: BASALT.surface,
                  fontSize: BASALT.text.micro,
                }),
                // cycle-expression-14: a zone label on one narrow band sits beside it, over the next column, so the caption is centred on its zone by hand.
                text(
                  plot.data.filter((w) => w.done === 0),
                  {
                    x: (w) => w.id,
                    y: () => Math.min(ISSUE_CAP, issuePeak(plot.data) + HEADROOM),
                    text: () => 'No done Issue',
                    anchor: () => 'middle',
                    dy: () => CAPTION_DROP,
                    fill: BASALT.ink,
                    fontSize: BASALT.text.micro,
                  },
                ),
              ]
            })}
            zones={data.weeks
              .filter((w) => w.done === 0)
              .map((w) => ({
                axis: 'x' as const,
                from: w.id,
                to: w.id,
                fill: alpha(BASALT.ink, 0.06),
              }))}
            focus={focus}
            tooltip={false}
            series={[
              { mark: 'bar', key: 'done', label: 'Done', color: N65_SERIES.done, y: (w) => w.done },
              {
                mark: 'bar',
                key: 'dropped',
                label: 'Dropped',
                color: N65_SERIES.dropped,
                y: (w) => w.dropped,
              },
              {
                mark: 'bar',
                key: 'cancelled',
                label: 'Cancelled',
                color: N65_SERIES.cancelled,
                y: (w) => w.cancelled,
              },
              {
                mark: 'bar',
                key: 'open',
                label: 'Open',
                color: N65_SERIES.open,
                y: (w) => w.open,
                values: true,
              },
            ]}
          />
        ) : null
      }
    />
  )
}

/** Fix commits per finding class and week, each line named at its own end. */
export function CommitsCard({ data, summary, phase, focus }: CardProps) {
  const leader = summary ? leaderOf(summary.now) : undefined
  const figure = {
    value: summary ? commitTotal(summary.now) : null,
    unit: 'commits',
    delta: {
      value: summary ? signed(commitTotal(summary.now) - commitTotal(summary.before)) : '',
      polarity: 'neutral' as const,
      label: 'vs W46',
    },
    period: 'W47',
    periodMono: true,
    status: focus.readout(
      { tone: 'neutral' as const, label: leader ? `${CLASS_LABEL[leader]} leads` : '' },
      (w) => ({
        tone: 'neutral' as const,
        label: weekReading(w, `${commitTotal(w)}, ${CLASS_LABEL[leaderOf(w)]} leads`),
      }),
    ),
  }
  const footer = [
    { label: 'Mean a week', value: summary ? oneDecimal(summary.commitMean) : '' },
    { label: 'Gate share', value: summary ? `${summary.gateShare} %` : '' },
  ] as const
  return (
    <ChartCard
      title="Fix commits by finding class"
      subtitle="Fixes landed, W40 to W47"
      phase={phase}
      empty={
        data?.weeks.length === 0
          ? { cause: 'No fix has landed yet. A line begins at the first fix.' }
          : null
      }
      figure={figure}
      footer={footer}
      height="short"
      chart={() =>
        data ? (
          <CartesianChart
            label="Lines per class"
            data={data.weeks}
            x={weekX}
            y={{ title: 'Fixes' }}
            focus={focus}
            tooltip={false}
            series={CLASSES.map((k) => ({
              mark: 'line' as const,
              key: k,
              label: CLASS_LABEL[k],
              color: N65_SERIES[k],
              weight: k === leader ? ('strong' as const) : ('quiet' as const),
              y: (w: Week) => w.commits[k],
            }))}
            marks={CartesianChart.custom<Week>((plot) => {
              const last = plot.data.at(-1)
              if (!last) return []
              const byId = new Map(CLASSES.map((k) => [k, last.commits[k]]))
              // cycle-expression-14: the Spec and Deploy end labels collide at 390 and drop, so the legend names those two lines there.
              // cycle-expression-14: a label anchored on the baseline is not drawn, so the zero line end is named from LABEL_LIFT px above it.
              const anchorY = (v: number): number =>
                Math.min(plot.y(v), plot.plotHeight - LABEL_LIFT)
              const { placed } = chartLabels.place(
                CLASSES.map((k) => ({
                  key: k,
                  text: `${CLASS_LABEL[k]} ${last.commits[k]}`,
                  x: plot.x(last.id) ?? 0,
                  y: anchorY(last.commits[k]),
                  priority: k === leader ? 2 : 1,
                })),
                { width: plot.plotWidth, height: plot.plotHeight },
                { gap: BASALT.dotR + 3 },
              )
              return [
                text(placed, {
                  x: () => last.id,
                  y: (l) => byId.get(l.key) ?? 0,
                  text: (l) => l.text,
                  dx: (l) => l.dx,
                  dy: (l) => l.dy + anchorY(byId.get(l.key) ?? 0) - plot.y(byId.get(l.key) ?? 0),
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
