import { text } from '@tanstack/charts/text'
import type { Delta, Verdict } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar, PageSummary, QueryState } from 'basalt-ui/page'
import { BASALT, alpha } from 'basalt-ui/tokens'
import type { ReactElement } from 'react'
import { VOLUME_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { WEEKS, buildLifts, type Lift, type WeekRow } from './fixture'

type Side = 'over' | 'under' | 'in'

const tonnes = (v: number): string => v.toFixed(1)

const sideOf = (lift: Lift, total: number): Side => {
  if (total > lift.mrv) return 'over'
  if (total < lift.mev) return 'under'
  return 'in'
}

/** Full weeks only: the partial current week is never judged. */
const fullWeeks = (lift: Lift): readonly WeekRow[] => lift.weeks.filter((w) => !w.partial)

type Standing = {
  side: Side
  /** Trailing full weeks on that side of the range. */
  run: number
  /** In range, but within a seventh of the range's width from an edge. */
  near: 'MEV' | 'MRV' | null
  last: WeekRow
}

function standingOf(lift: Lift): Standing {
  const weeks = fullWeeks(lift)
  const last = weeks[weeks.length - 1] as WeekRow
  const side = sideOf(lift, last.total)
  let run = 0
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (sideOf(lift, (weeks[i] as WeekRow).total) !== side) break
    run++
  }
  const margin = (lift.mrv - lift.mev) / 7
  const near =
    side !== 'in'
      ? null
      : last.total - lift.mev < margin
        ? 'MEV'
        : lift.mrv - last.total < margin
          ? 'MRV'
          : null
  return { side, run, near, last }
}

const verdictOf = (side: Side, near: Standing['near']): Verdict => {
  if (side === 'over') return { tone: 'warn', label: 'Over maximum' }
  if (side === 'under') return { tone: 'warn', label: 'Under minimum' }
  if (near !== null)
    return { tone: 'neutral', label: near === 'MEV' ? 'Near minimum' : 'Near maximum' }
  return { tone: 'neutral', label: 'In range' }
}

const deltaOf = (lift: Lift, total: number): Delta => {
  const diff = total - lift.typical
  return {
    value: `${diff > 0 ? '+' : diff < 0 ? '-' : ''}${tonnes(Math.abs(diff))} t`,
    polarity: 'neutral',
    label: 'vs typical',
  }
}

// cycle-expression-6: a figure's delta cannot be absent while another readout fills it, so a partial week carries a word in its place.
const PARTIAL_DELTA: Delta = { value: 'partial', polarity: 'neutral', label: 'no verdict' }

const weekLabel = (key: number | Date | string): string =>
  key === `W${WEEKS}` ? `W${WEEKS} so far` : String(key)

function LiftCard({ lift, loading }: { lift: Lift; loading: boolean }): ReactElement {
  const focus = useChartFocus(lift.weeks, {
    announce: (d) =>
      `${lift.name}, ${d.week}${d.partial ? ' so far' : ''}: ${tonnes(d.total)} t, warm-up ${tonnes(d.warmup)}, work ${tonnes(d.work)}, drop ${tonnes(d.drop)}, AMRAP ${tonnes(d.amrap)}`,
  })
  const standing = standingOf(lift)
  const peak = Math.max(lift.mrv, ...lift.weeks.map((w) => w.total))
  const rest = verdictOf(standing.side, standing.near)
  const outside = (d: WeekRow): boolean => !d.partial && sideOf(lift, d.total) !== 'in'
  const outCount = fullWeeks(lift).filter(outside).length
  const top = fullWeeks(lift).reduce((a, b) => (b.total > a.total ? b : a))

  return (
    <ChartCard
      title={lift.name}
      subtitle={`Range ${tonnes(lift.mev)} to ${tonnes(lift.mrv)} t, typical ${tonnes(lift.typical)} t`}
      phase={loading ? 'loading' : 'ready'}
      figure={
        loading
          ? { value: null, unit: 't' }
          : {
              // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n20, kept as its builder left it: its figure follows focus, built before figure-readout
              value: focus.readout(tonnes(standing.last.total), (d) => tonnes(d.total)),
              unit: 't',
              period: focus.readout(`${standing.last.week}, last full week`, (d) =>
                d.partial ? `${d.week}, so far` : d.week,
              ),
              // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n20, kept as its builder left it: its figure follows focus, built before figure-readout
              delta: focus.readout<Delta>(deltaOf(lift, standing.last.total), (d) =>
                d.partial ? PARTIAL_DELTA : deltaOf(lift, d.total),
              ),
              status: focus.readout<Verdict>(rest, (d) =>
                d.partial
                  ? { tone: 'neutral', label: 'Week so far' }
                  : verdictOf(sideOf(lift, d.total), null),
              ),
            }
      }
      footer={[
        { label: 'Weeks out of range', value: loading ? '-' : `${outCount} of ${WEEKS - 1}` },
        { label: 'Peak week', value: loading ? '-' : `${top.week}, ${tonnes(top.total)} t` },
      ]}
      chart={() => (
        <CartesianChart
          label={`${lift.name}: tonnes lifted per week by set type, against its productive range`}
          data={lift.weeks}
          focus={focus}
          x={{
            value: (d) => d.week,
            format: weekLabel,
            ticks: ['W1', 'W5', 'W9', `W${WEEKS}`],
          }}
          y={{ title: 'Tonnes', domain: [0, Math.ceil(peak * 1.18)] }}
          series={[
            {
              mark: 'bar',
              key: 'warmup',
              label: 'Warm-up',
              color: VOLUME_SERIES.warmup,
              y: (d) => d.warmup,
              opacity: (d) => (d.partial ? 0.45 : 1),
            },
            {
              mark: 'bar',
              key: 'work',
              label: 'Work sets',
              color: VOLUME_SERIES.work,
              y: (d) => (outside(d) ? null : d.work),
              opacity: (d) => (d.partial ? 0.45 : 1),
            },
            {
              mark: 'bar',
              key: 'workOut',
              label: 'Work sets, week out of range',
              color: VOLUME_SERIES.out,
              y: (d) => (outside(d) ? d.work : null),
            },
            {
              mark: 'bar',
              key: 'drop',
              label: 'Drop sets',
              color: VOLUME_SERIES.drop,
              y: (d) => d.drop,
              opacity: (d) => (d.partial ? 0.45 : 1),
            },
            {
              mark: 'bar',
              key: 'amrap',
              label: 'AMRAP',
              color: VOLUME_SERIES.amrap,
              y: (d) => d.amrap,
              opacity: (d) => (d.partial ? 0.45 : 1),
            },
          ]}
          zones={[
            {
              axis: 'x',
              from: 'W1',
              to: `W${WEEKS}`,
              y: { from: lift.mev, to: lift.mrv },
              fill: alpha(BASALT.inkMuted, 0.12),
              label: 'Productive range',
            },
          ]}
          refLines={[
            { value: lift.typical, color: VOLUME_SERIES.typical, dashed: true, label: 'Typical' },
          ]}
          marks={CartesianChart.custom<WeekRow>((plot) => {
            // cycle-expression-6: the kit has no zero cue for a stacked bar, so a week of no sets gets a "0" text mark.
            const zeros = plot.data.filter((d) => d.total === 0 && !d.partial)
            // cycle-expression-6: the kit has no annotation for "how far past or near a limit", so the last full week of a lift out of range or near an edge is written as a text mark.
            const gap =
              standing.side === 'over'
                ? `${tonnes(standing.last.total - lift.mrv)} t over, ${standing.run} wk`
                : standing.side === 'under'
                  ? `${standing.run} wk under`
                  : standing.near === 'MEV'
                    ? `${tonnes(standing.last.total - lift.mev)} t above minimum`
                    : standing.near === 'MRV'
                      ? `${tonnes(lift.mrv - standing.last.total)} t below maximum`
                      : null
            const out =
              gap === null
                ? []
                : [
                    {
                      week: standing.last.week,
                      // Above the tallest of the last four full weeks so the words clear the bars; an under-range lift reads on its minimum.
                      at:
                        standing.side === 'under'
                          ? lift.mev
                          : Math.max(
                              ...fullWeeks(lift)
                                .slice(-4)
                                .map((w) => w.total),
                            ),
                      label: gap,
                    },
                  ]
            return [
              text(zeros, {
                x: (d) => d.week,
                y: () => 0,
                text: () => '0',
                dy: -8,
                fill: BASALT.ink,
                fontSize: BASALT.text.micro,
              }),
              text(out, {
                x: (d) => d.week,
                y: (d) => d.at,
                text: (d) => d.label,
                dy: -8,
                anchor: 'end',
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

/** The sentence that answers the question: which lifts are out of range, and how long. */
function summaryOf(lifts: readonly Lift[]): { sentence: string; facts: (string | false)[] } {
  const standings = lifts.map((lift) => ({ lift, s: standingOf(lift) }))
  const out = standings.filter(({ s }) => s.side !== 'in')
  const sentence =
    out.length === 0
      ? 'All four lifts are inside their productive range'
      : out
          .map(({ lift, s }) =>
            s.side === 'over'
              ? `${lift.name} is over its maximum recoverable volume for ${s.run} ${s.run === 1 ? 'week' : 'weeks'}`
              : `${lift.name} is under its minimum effective volume for ${s.run} ${s.run === 1 ? 'week' : 'weeks'}`,
          )
          .join('; ')
  return {
    sentence,
    facts: [],
  }
}

export function ExprN20Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const loading = shotState === 'loading'
  const lifts = buildLifts(fixture)
  // Drifting lifts first, so the answer is in the first card.
  const ordered = [...lifts].sort(
    (a, b) => Number(standingOf(b).side !== 'in') - Number(standingOf(a).side !== 'in'),
  )
  const summary = shotState === undefined ? summaryOf(lifts) : null

  return (
    <Page area="expr-n20">
      <PageBar title="Weekly volume by lift, 16 weeks" />
      {loading ? <PageSummary phase="loading" facts={[]} /> : null}
      {summary === null ? null : <PageSummary sentence={summary.sentence} facts={summary.facts} />}
      <QueryState
        phase={
          shotState === 'error'
            ? {
                tag: 'error',
                message: 'The training log did not answer.',
                retry: () => undefined,
              }
            : 'ready'
        }
        empty={
          shotState === 'empty'
            ? {
                cause:
                  'No sets are logged in the last 16 weeks. Log a session and its volume appears here.',
              }
            : null
        }
      >
        {/* cycle-expression-6: CardGrid has no two-column tier, so four cards in a 2 by 2 take a container grid. */}
        <div className="@container">
          <div className="grid gap-4 @wide:grid-cols-2">
            {ordered.map((lift) => (
              <LiftCard key={lift.id} lift={lift} loading={loading} />
            ))}
          </div>
        </div>
      </QueryState>
    </Page>
  )
}
