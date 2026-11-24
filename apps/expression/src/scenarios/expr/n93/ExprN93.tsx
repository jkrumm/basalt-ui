import { DataPanel } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { text } from '@tanstack/charts/text'
import { Bars, CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import type { Format } from 'basalt-ui'
import { useFormat } from 'basalt-ui'
import { Page, PageBar, CardGrid } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { N93_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { fixtureOf, isCalendarDate } from './fixture'
import type { Day } from './fixture'

const noop = (): void => undefined

// cycle-expression-19: the kit has no stack-aware y cap (a function domain reads one series' extent), so the cap is a fixed pair.
/** The y of the minutes pane stops here: one 4-hour day would flatten the others. A function domain reads a single series' extent, not the stack total, so this is a fixed pair. */
const MINUTES_CAP = 100
// cycle-expression-19: the kit has no outlier cap that reads the median, so the steps cap is a fixed number too.
const STEPS_CAP = 15_000
/** Both panes reserve one gutter so their plots start and end on one x. */
const GUTTER = 48

/** A day of the export with the words the list prints; the charts draw these same rows. */
type Row = Day & { id: string; label: string; note: string | null }

const c = col<Row>()
const COLUMNS = [
  c.entity('label', { header: 'Day', mono: true, sub: (r) => r.note, priority: 1 }),
  c.number('vigorous', { header: 'Vig.', priority: 1 }),
  c.number('moderate', { header: 'Mod.', priority: 2 }),
  c.number('steps', { header: 'Steps', priority: 2 }),
  c.number('score', { header: 'Score', priority: 3 }),
]

const median = (values: readonly number[]): number => {
  const sorted = values.toSorted((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const hi = sorted[mid] ?? 0
  return sorted.length % 2 === 1 ? hi : ((sorted[mid - 1] ?? hi) + hi) / 2
}

const present = (values: readonly (number | null)[]): number[] =>
  values.filter((v): v is number => v !== null)

/** The runs of days with no reading at all, in date order. */
function gapRuns(days: readonly Day[]): Day[][] {
  const runs: Day[][] = []
  let open: Day[] | null = null
  for (const d of days) {
    if (d.steps !== null || d.vigorous !== null || d.moderate !== null) {
      open = null
      continue
    }
    if (open === null) {
      open = []
      runs.push(open)
    }
    open.push(d)
  }
  return runs
}

const dayName = (f: Format, d: Day): string =>
  `${f.date(d.date, 'weekday')} ${f.date(d.date, 'day')}`

export function ExprN93Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const { days: all } = fixtureOf(fixture)
  const span = all.length
  const days: Row[] =
    shotState === 'empty'
      ? []
      : all.map((d) => ({
          ...d,
          id: d.date,
          label: dayName(f, d),
          note: d.steps !== null && d.score === null ? 'No score' : null,
        }))
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The watch export did not answer.' }
        : 'ready'
  const ready = phase === 'ready' && days.length > 0

  const readout = (d: Row): string =>
    d.steps === null
      ? `${dayName(f, d)}: no reading`
      : `${dayName(f, d)}: ${d.vigorous ?? 0} min vigorous, ${d.moderate ?? 0} min moderate, ${f.number(d.steps)} steps`
  /** The figure period at 390 is one mono line, so it carries the numbers short. */
  const brief = (d: Row): string =>
    d.steps === null
      ? `${dayName(f, d)}: none`
      : `${dayName(f, d)}: ${d.vigorous ?? 0}+${d.moderate ?? 0} min, ${f.number(d.steps)} steps`

  const focus = useChartFocus(days, { announce: readout })

  const runs = gapRuns(days)
  const missing = runs.reduce((n, r) => n + r.length, 0)
  const medianVigorous = Math.round(median(present(days.map((d) => d.vigorous))))
  const medianSteps = Math.round(median(present(days.map((d) => d.steps))))
  const unscored = days.filter((d) => d.steps !== null && d.score === null)
  const longest = days.reduce<Day | null>(
    (best, d) => ((d.vigorous ?? -1) > (best?.vigorous ?? -1) ? d : best),
    null,
  )
  const runText = (run: readonly Day[]): string => {
    const first = run[0]
    const last = run.at(-1)
    if (first === undefined || last === undefined) return ''
    return run.length === 1
      ? f.date(first.date, 'day')
      : `${f.date(first.date, 'day')} to ${f.date(last.date, 'day')}`
  }

  const table = useDataTable({
    id: 'expr-n93-days',
    label: 'Days of the export',
    columns: COLUMNS,
    data: days,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    phone: 'columns',
    bodyRows: 12,
    empty: { cause: 'No days to list yet.' },
  })

  // cycle-expression-19: the kit has no absent-reading band; the no-reading runs are x zones built by hand from the null rows.
  const gapZones = runs.map((run, i) => ({
    axis: 'x' as const,
    from: run[0]?.date ?? '',
    to: run.at(-1)?.date ?? '',
    fill: alpha(BASALT.brand, 0.12),
    ...(i === 0 ? { label: 'No reading' } : {}),
  }))
  const x = (ticks: number | readonly string[]) => ({
    value: (d: Row) => d.date,
    format: (key: number | Date | string) =>
      typeof key === 'string' && isCalendarDate(key) ? f.date(key, 'day') : '',
    ticks,
  })
  const minutes = () => (
    <Bars
      layout="grouped"
      label={`Vigorous and moderate minutes for each of the last ${span} days`}
      data={days}
      focus={focus}
      tooltip={false}
      x={x(0)}
      y={{
        title: 'Minutes',
        gutter: GUTTER,
        domain: [0, MINUTES_CAP],
      }}
      zones={gapZones}
      refLines={[
        {
          value: medianVigorous,
          color: N93_SERIES.median,
          dashed: true,
          label: `Median vigorous ${medianVigorous} min`,
        },
      ]}
      series={[
        {
          mark: 'bar',
          key: 'vigorous',
          label: 'Vigorous',
          color: N93_SERIES.vigorous,
          y: (d) => d.vigorous,
        },
        {
          mark: 'bar',
          key: 'moderate',
          label: 'Moderate',
          color: N93_SERIES.moderate,
          y: (d) => d.moderate,
        },
      ]}
    />
  )
  const steps = () => (
    <CartesianChart
      label={`Steps for each of the last ${span} days`}
      data={days}
      focus={focus}
      tooltip={false}
      x={x(6)}
      y={{ title: 'Steps', gutter: GUTTER, domain: [0, STEPS_CAP] }}
      zones={gapZones.map(({ label: _label, ...z }) => z)}
      // cycle-expression-19: a table-row focus draws no x chip or guide on the bars; the focused day is named on its own steps bar.
      marks={CartesianChart.custom<Row>((plot) => {
        const d = plot.focused
        if (d === null || d.steps === null) return []
        return [
          text([d], {
            x: (r) => r.date,
            y: (r) => Math.min(r.steps ?? 0, STEPS_CAP),
            text: (r) => dayName(f, r),
            dy: -8,
            anchor: 'middle',
            fill: BASALT.ink,
            fontSize: BASALT.text.micro,
          }),
        ]
      })}
      refLines={[
        {
          value: medianSteps,
          color: N93_SERIES.median,
          dashed: true,
          label: `Median ${f.number(medianSteps)} steps`,
        },
      ]}
      series={[
        {
          mark: 'bar',
          key: 'steps',
          label: 'Steps',
          color: N93_SERIES.steps,
          y: (d) => d.steps,
        },
      ]}
    />
  )

  return (
    <Page area="expr-n93">
      <PageBar title={`Daily activity, last ${span} days`} />
      <CardGrid min="regular">
        <ChartCard
          title="Minutes and steps by day"
          phase={phase}
          empty={
            shotState === 'empty'
              ? { cause: 'No readings in this window. Sync the watch to fill the days.' }
              : null
          }
          height="tall"
          figure={
            ready
              ? {
                  value: missing,
                  unit: `of ${span} days missing`,
                  period: focus.readout(
                    runs.length === 0 ? 'None missing' : runs.map(runText).join(', '),
                    brief,
                  ),
                  periodMono: true,
                }
              : { value: null }
          }
          footer={
            ready
              ? [
                  {
                    label: 'Peak day',
                    value: `${longest === null ? '' : f.date(longest.date, 'day')}, ${longest?.vigorous ?? 0} min`,
                    mono: true,
                  },
                  {
                    label: 'No score',
                    value:
                      unscored.length === 0
                        ? 'none'
                        : unscored.map((d) => f.date(d.date, 'day')).join(', '),
                    mono: true,
                  },
                ]
              : [
                  { label: 'Peak day', value: '', mono: true },
                  { label: 'No score', value: '', mono: true },
                ]
          }
          panes={[
            { weight: 3, chart: minutes },
            { weight: 2, chart: steps },
          ]}
        />
        <DataPanel
          title="Days"
          subtitle="Vigorous and moderate in minutes"
          phase={phase}
          empty={shotState === 'empty' ? { cause: 'Nothing to list yet.' } : null}
          bodySize={{ rows: 23, cardHeight: 33 }}
          body={() => <DataTable table={table} focus={focus} height="fill" />}
        />
      </CardGrid>
    </Page>
  )
}
