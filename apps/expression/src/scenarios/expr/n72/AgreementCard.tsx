import { text } from '@tanstack/charts/text'
import { CartesianChart, ChartCard, chartLabels } from 'basalt-ui/charts'
import type { ChartFocus } from 'basalt-ui/charts'
import type { Phase } from 'basalt-ui/cards'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { N72_SERIES } from '../../../demo/series'
import { SURE, VERDICT_WORD, xOf, type Kind, type Stats, type Submission } from './fixture'

/** The word for each case, in the legend, the zone, the status and the table. */
export const CASE_LABEL: Record<Kind, string> = {
  agree: 'Agree',
  other: 'One unsure',
  sure: 'Both sure',
  delivered: 'Spam delivered',
}

const percent = (v: number): string => `${v} %`

/** A rate in points, with a true minus. */
const points = (v: number): string => `${v < 0 ? '\u2212' : '+'}${Math.abs(v).toFixed(1)} pts`

const rate = (split: number, pairs: number): number => (pairs === 0 ? 0 : (split / pairs) * 100)

/** One dot series per case; a datum draws in the series of its own case only. */
const dots = (kind: Kind, r: number) => ({
  mark: 'dot' as const,
  key: kind,
  label: CASE_LABEL[kind],
  color: N72_SERIES[kind],
  r: () => r,
  spread: 'y' as const,
  format: percent,
  y: (d: Submission) => (d.kind === kind ? d.secondConf : null),
})

const SERIES = [dots('agree', 3), dots('other', 4), dots('sure', 5), dots('delivered', 6)]

export function AgreementCard({
  phase,
  empty,
  focus,
  stats,
}: {
  phase: Phase
  empty: boolean
  focus: ChartFocus<Submission>
  stats: Stats
}) {
  const ready = phase === 'ready'
  const rest = {
    tone: stats.delivered > 0 ? ('bad' as const) : ('neutral' as const),
    label: `${CASE_LABEL.delivered}: ${stats.delivered}`,
  }
  const gap = rate(stats.sureSplit, stats.surePairs) - rate(stats.unsureSplit, stats.unsurePairs)
  return (
    <ChartCard
      title="Classifier agreement"
      subtitle="Confidence of each verdict, one dot per submission"
      phase={phase}
      empty={
        empty
          ? { cause: 'No submission in the log. Scores appear when a form is submitted.' }
          : null
      }
      height="tall"
      figure={{
        value: ready ? `${stats.sureSplit} of ${stats.surePairs}` : null,
        period: focus.readout(
          ready ? 'disagree when both are sure' : '',
          (d) => `${d.form}: ${d.firstText}, ${d.secondText}`,
        ),
        delta: ready
          ? { value: points(gap), polarity: 'neutral', label: 'vs unsure pairs' }
          : undefined,
        status: focus.readout(ready ? rest : { tone: 'neutral', label: '' }, (d) => ({
          tone: d.kind === 'delivered' ? 'bad' : 'neutral',
          label: d.outcome,
        })),
      }}
      footer={[
        {
          label: 'One verdict only',
          value: ready ? `${stats.noSecond}, ${stats.failed} errored` : '',
        },
      ]}
      chart={() => (
        <CartesianChart
          label="Scatter of both verdicts for every message"
          data={focus.items}
          focus={focus}
          tooltip={false}
          x={{
            value: xOf,
            format: (x) => String(Math.round(Number(x))),
            title: 'First classifier, %',
            domain: [50, 100],
          }}
          y={{ title: 'Second classifier, %', domain: [50, 100] }}
          series={SERIES}
          zones={[
            {
              axis: 'x',
              from: SURE,
              to: 100,
              y: { from: SURE, to: 100 },
              fill: alpha(BASALT.ink, 0.06),
              label: `${CASE_LABEL.sure}, ${SURE} %+`,
            },
          ]}
          marks={CartesianChart.custom<Submission>((plot) => {
            const r = BASALT.dotR + 1
            const obstacles = plot.data.map((d) => ({
              left: (plot.x(xOf(d)) ?? 0) - r,
              top: plot.y(d.secondConf ?? 0) - r,
              width: 2 * r,
              height: 2 * r,
            }))
            const sure = plot.data.filter((d) => d.kind === 'sure')
            const delivered = plot.data.filter((d) => d.kind === 'delivered')
            const lead = delivered[0]
            const named = [
              ...(lead === undefined ? [] : [{ d: lead, text: CASE_LABEL.delivered, priority: 3 }]),
              ...sure.map((d) => ({
                d,
                text: `${VERDICT_WORD[d.first]} vs ${VERDICT_WORD[d.second ?? 'legit'].toLowerCase()}`,
                priority: 2,
              })),
            ]
            const byId = new Map(named.map((n) => [n.d.id, n.d]))
            const { placed } = chartLabels.place(
              named.map((n) => ({
                key: n.d.id,
                text: n.text,
                x: plot.x(xOf(n.d)) ?? 0,
                y: plot.y(n.d.secondConf ?? 0),
                priority: n.priority,
              })),
              { width: plot.plotWidth, height: plot.plotHeight },
              { obstacles, gap: BASALT.dotR + 3 },
            )
            return [
              text(placed, {
                x: (l) => {
                  const d = byId.get(l.key)
                  return d === undefined ? 0 : xOf(d)
                },
                y: (l) => byId.get(l.key)?.secondConf ?? 0,
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
  )
}
