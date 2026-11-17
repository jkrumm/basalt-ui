import { useFormat } from 'basalt-ui'
import type { Format } from 'basalt-ui'
import type { Delta, Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { CardGrid, EmptyState, Page, PageBar, PageSummary, QueryState } from 'basalt-ui/page'
import { text } from '@tanstack/charts/text'
import { HEALTH_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { FIRST_WEEK, THIS_WEEK, measuresFor } from './fixture'
import type { Measure } from './fixture'

/** A change under this share of last week's value reads as steady. */
const STEADY_BELOW = 0.02
const LAST = THIS_WEEK - FIRST_WEEK

type Move = 'slid' | 'better' | 'steady' | 'unmeasured'

type Change = {
  move: Move
  /** The last week before the compared one that has a value. */
  base: { value: number; week: number } | null
}

type Reading = { measure: Measure; move: Move; now: number | null }

type Row = {
  week: number
  value: number | null
  /** The complete weeks; the partial week is its own dashed segment. */
  solid: number | null
  partial: number | null
}

const MOVE_ORDER: readonly Move[] = ['slid', 'better', 'steady', 'unmeasured']

/** How week `i` compares with the last measured week before it. */
function changeAt(measure: Measure, i: number): Change {
  const now = measure.weeks[i] ?? null
  let base: Change['base'] = null
  for (let j = i - 1; j >= 0 && base === null; j -= 1) {
    const value = measure.weeks[j]
    if (typeof value === 'number') base = { value, week: FIRST_WEEK + j }
  }
  if (now === null || base === null) return { move: 'unmeasured', base }
  const rel = base.value === 0 ? (now === 0 ? 0 : 1) : (now - base.value) / base.value
  if (Math.abs(rel) < STEADY_BELOW) return { move: 'steady', base }
  const good = (measure.better === 'higher') === now > base.value
  return { move: good ? 'better' : 'slid', base }
}

function read(measure: Measure): Reading {
  return {
    measure,
    move: changeAt(measure, LAST).move,
    now: measure.weeks[LAST] ?? null,
  }
}

const MINUS = '−'

/** A signed change for week `i`: points for a share, a relative step for the rest. */
function deltaAt(measure: Measure, i: number, fmt: Format): Delta | undefined {
  const now = measure.weeks[i] ?? null
  const { move, base } = changeAt(measure, i)
  if (now === null || base === null || move === 'unmeasured') return undefined
  const label = `vs W${base.week}`
  const polarity = measure.better === 'lower' ? 'up-bad' : 'up-good'
  if (move === 'steady') return { value: '0%', polarity: 'neutral', label }
  const diff = now - base.value
  const sign = diff < 0 ? MINUS : '+'
  const body =
    measure.unit === '%'
      ? `${fmt.number(Math.abs(diff), { maximumFractionDigits: 1 })} pts`
      : base.value === 0
        ? fmt.number(Math.abs(diff), { maximumFractionDigits: 1 })
        : fmt.percent(Math.abs(diff / base.value), { maximumFractionDigits: 0 })
  return { value: `${sign}${body}`, polarity, label }
}

const median = (values: readonly number[]): number => {
  const sorted = values.toSorted((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const low = sorted[mid - 1] ?? 0
  const high = sorted[mid] ?? 0
  return sorted.length % 2 === 0 ? (low + high) / 2 : high
}

/** One value that dwarfs the rest: its week, its true size and the axis cap that keeps the others readable. */
function outlierOf(measure: Measure): { week: number; value: number; cap: number } | null {
  const points = measure.weeks.flatMap((value, i) =>
    value === null ? [] : [{ week: FIRST_WEEK + i, value }],
  )
  const top = points.toSorted((a, b) => b.value - a.value)[0]
  if (top === undefined) return null
  const rest = points.filter((p) => p !== top).map((p) => p.value)
  const mean = rest.reduce((a, b) => a + b, 0) / Math.max(rest.length, 1)
  if (top.value <= mean * 3) return null
  return { ...top, cap: Math.max(...rest) * 1.3 }
}

function MeasureCard({ r, phase }: { r: Reading; phase: Phase }) {
  const fmt = useFormat()
  const { measure } = r
  const num = (v: number) => fmt.number(v, { maximumFractionDigits: measure.digits })
  const withUnit = (v: number) =>
    measure.unit === '%' || measure.unit.startsWith('/')
      ? `${num(v)}${measure.unit}`
      : `${num(v)} ${measure.unit}`
  const loading = phase === 'loading'
  // cycle-expression-8: a line kind has no partial-last-point style, so the partial week is a second dashed series over the last segment
  const rows: Row[] = measure.weeks.map((value, i) => ({
    week: FIRST_WEEK + i,
    value,
    solid: i < LAST ? value : null,
    partial: i >= LAST - 1 ? value : null,
  }))
  const focus = useChartFocus(rows, {
    announce: (d) =>
      d.value === null
        ? `W${d.week}: not measured`
        : `W${d.week}: ${withUnit(d.value)}${d.week === THIS_WEEK ? ', week so far' : ''}`,
  })
  const seen = measure.weeks.slice(0, LAST).filter((w): w is number => w !== null)
  const best = rows
    .slice(0, LAST)
    .filter((d) => d.value !== null)
    .toSorted((a, b) =>
      measure.better === 'lower'
        ? (a.value ?? 0) - (b.value ?? 0)
        : (b.value ?? 0) - (a.value ?? 0),
    )[0]
  const mid = median(seen)
  const outlier = outlierOf(measure)
  const direction = measure.better === 'lower' ? 'Lower is better.' : 'Higher is better.'
  return (
    <ChartCard
      title={measure.name}
      info={`${measure.info} ${direction}`}
      phase={phase}
      height="short"
      figure={{
        value: loading ? null : focus.readout(r.now, (d) => d.value),
        unit: measure.unit,
        delta: loading
          ? undefined
          : focus.readout(deltaAt(measure, LAST, fmt), (d) =>
              deltaAt(measure, d.week - FIRST_WEEK, fmt),
            ),
        period: loading
          ? undefined
          : focus.readout(
              r.now === null ? `W${THIS_WEEK}, not measured yet` : `W${THIS_WEEK} so far`,
              (d) => `W${d.week}`,
            ),
        periodMono: true,
      }}
      footer={[
        { label: `Median to W${THIS_WEEK - 1}`, value: loading ? ' ' : withUnit(mid) },
        {
          label: 'Best week',
          value: loading || best === undefined ? ' ' : `W${best.week}`,
          mono: true,
        },
      ]}
      chart={(box) => (
        <CartesianChart
          label={`${measure.name} per week, W${FIRST_WEEK} to W${THIS_WEEK}`}
          data={rows}
          height={box.height}
          x={{
            value: (d) => d.week,
            format: (v) => `W${v}`,
            ticks: [FIRST_WEEK, FIRST_WEEK + 5, THIS_WEEK],
          }}
          y={
            outlier === null
              ? { format: num, domain: { floor: 0 } }
              : { format: num, domain: ([, hi]) => [0, Math.min(hi, outlier.cap)] }
          }
          series={[
            {
              mark: 'line',
              key: 'solid',
              label: measure.name,
              color: HEALTH_SERIES.weekly,
              y: (d) => d.solid,
              format: withUnit,
            },
            {
              mark: 'line',
              key: 'partial',
              label: `${measure.name}, week so far`,
              color: HEALTH_SERIES.weekly,
              dash: true,
              legend: false,
              y: (d) => d.partial,
              format: withUnit,
            },
          ]}
          refLines={[{ value: mid, color: HEALTH_SERIES.median }]}
          tooltip={false}
          focus={focus}
          marks={CartesianChart.custom<Row>((plot) => {
            // cycle-expression-8: no capped-peak label on the kit's caret, so a hand-placed text mark names it; chartLabels drops it when no spot is free (the 8.6 cap sits on the plot edge)
            if (outlier === null || outlier.week === THIS_WEEK) return []
            const { placed } = chartLabels.place(
              [
                {
                  key: 'peak',
                  text: withUnit(outlier.value),
                  x: plot.x(outlier.week) ?? 0,
                  y: plot.y(Math.min(outlier.value, outlier.cap)),
                },
              ],
              { width: plot.plotWidth, height: plot.plotHeight },
            )
            return [
              text(placed, {
                x: () => outlier.week,
                y: () => Math.min(outlier.value, outlier.cap),
                text: (l) => l.text,
                dx: (l) => l.dx,
                dy: (l) => l.dy,
                anchor: (l) => l.textAnchor,
              }),
            ]
          })}
        />
      )}
    />
  )
}

export function ExprN27Scenario({ shotState, fixture }: ScenarioProps) {
  const title = 'Factory health, 12 weeks'
  if (shotState === 'empty') {
    return (
      <Page area="expr-n27">
        <PageBar title={title} />
        <EmptyState
          title="No health measures yet"
          cause="Measures appear after the factory finishes its first full week of work."
        />
      </Page>
    )
  }
  if (shotState === 'error') {
    const phase: Phase = {
      tag: 'error',
      retry: () => undefined,
      message: 'The health service did not answer.',
    }
    return (
      <Page area="expr-n27">
        <PageBar title={title} />
        <PageSummary phase={phase} />
        <QueryState phase={phase} tier="page">
          {null}
        </QueryState>
      </Page>
    )
  }
  const loading = shotState === 'loading'
  const readings = measuresFor(fixture)
    .map(read)
    .toSorted((a, b) => MOVE_ORDER.indexOf(a.move) - MOVE_ORDER.indexOf(b.move))
  const count = (m: Move) => readings.filter((r) => r.move === m).length
  const slid = count('slid')
  const better = count('better')
  const unmeasured = count('unmeasured')
  const moved = slid + better
  const sentence =
    moved === 0
      ? count('steady') > 0
        ? 'No measure has moved since last week'
        : 'No measure has a value yet this week'
      : slid === 0
        ? `Nothing slid, ${better} moved the right way`
        : `${slid} slid, ${better} moved the right way`
  return (
    <Page area="expr-n27">
      <PageBar title={title} />
      {loading ? (
        <PageSummary phase="loading" facts={[' ']} />
      ) : (
        <PageSummary
          sentence={sentence}
          facts={[
            moved > 0 && unmeasured > 0 && `${unmeasured} not measured yet`,
            moved > 0 && count('steady') > 0 && `${count('steady')} steady`,
          ]}
        />
      )}
      <CardGrid min="regular">
        {readings.map((r) => (
          <MeasureCard key={r.measure.id} r={r} phase={loading ? 'loading' : 'ready'} />
        ))}
      </CardGrid>
    </Page>
  )
}
