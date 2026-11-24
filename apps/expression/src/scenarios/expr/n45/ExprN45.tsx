import { text } from '@tanstack/charts/text'
import { useFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import type { Empty, Phase, Verdict } from 'basalt-ui/cards'
import type { LegendEntry } from 'basalt-ui/charts'
import { CartesianChart, ChartCard, Sparkline, chartLabels, useChartFocus } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { CONTAINER_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { NOW } from './fixture'
import { NEAR, OFTEN, summaryNamed } from './summary'
import type { Row } from './summary'

/** The restart count the chart scales to; a loop past it is the kit's off-scale caret with its true count. */
const RESTART_CAP = 12
const noop = (): void => undefined

const c = col<Row>()
const COLUMNS = [
  c.entity('name', {
    header: 'Container',
    mono: true,
    sub: (r) => `${r.host} · ${r.image}`,
    subMono: true,
    priority: 1,
  }),
  c.status('state', {
    header: 'State',
    options: ['running', 'restarting', 'exited'],
    tone: (s) => (s === 'restarting' ? 'bad' : 'neutral'),
    priority: 2,
  }),
  c.number('restarts', { header: 'Restarts, 7 days', priority: 1 }),
  c.spark('perDay', {
    header: 'Per day',
    label: 'Restarts per day, last 7 days',
    priority: 3,
    render: (r, box) => (
      <Sparkline label={`${r.name}: restarts per day`} points={r.perDay} height={box.height} />
    ),
  }),
  c.meter('peakPct', { header: 'Peak memory, % of limit', max: 100, priority: 1 }),
  c.spark('memory', {
    header: 'Memory, 24 h',
    label: 'Memory in use over the last 24 hours',
    priority: 3,
    render: (r, box) =>
      r.limitMiB === null ? (
        <span className="text-xs text-muted-foreground tabular-nums">
          {Math.round(r.usedMiB)} MiB, no limit
        </span>
      ) : (
        <Sparkline
          label={`${r.name}: memory in percent of its limit`}
          points={r.pct}
          height={box.height}
          reference={{ min: NEAR, max: 100 }}
        />
      ),
  }),
  c.relativeTime('lastRestart', { header: 'Last restart', priority: 3 }),
]

// cycle-expression-11: a chart's own legend is drawn inside the box and a loading card has none, so the legend is the card's, drawn in every phase
const LEGEND: readonly LegendEntry[] = [
  { key: 'quiet', label: 'Within both lines', color: CONTAINER_SERIES.quiet, swatch: 'dot' },
  { key: 'flagged', label: 'Past a line', color: CONTAINER_SERIES.flagged, swatch: 'dot' },
]

const announce = (d: Row): string =>
  `${d.name} on ${d.host}: ${d.restarts} restarts in 7 days, peak ${d.peakPct}% of its memory limit`

export function ExprN45Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const s = summaryNamed(shotState === 'empty' ? 'none' : fixture)
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? {
            tag: 'error',
            retry: noop,
            message: 'The Docker agents on the three hosts did not answer.',
          }
        : 'ready'
  const empty: Empty | null =
    s.rows.length === 0
      ? {
          cause: 'No container has reported yet. Start the Docker agent on each host, then reload.',
        }
      : null
  const ready = phase === 'ready' && s.rows.length > 0

  const focus = useChartFocus(s.plotted, { announce })
  const table = useDataTable({
    id: 'containers',
    label: 'Containers',
    columns: COLUMNS,
    data: s.rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    bodyRows: 11,
    now: NOW,
  })

  const restFlag: Verdict =
    s.near > 0
      ? { tone: 'bad', label: `${s.near} near their memory limit` }
      : { tone: 'neutral', label: 'None near a memory limit' }
  const flagOf = (d: Row): Verdict =>
    d.peakPct === null
      ? { tone: 'neutral', label: `${d.name}, no memory limit` }
      : { tone: d.near ? 'bad' : 'neutral', label: `${d.name}, ${d.peakPct}% of limit` }
  const since = s.loopSince
  const clock = (t: number): string =>
    `${f.date(t, 'weekday')} ${f.time(t, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}`

  return (
    <Page area="expr-n45">
      <PageBar title="Homelab containers" />
      <CardGrid min="wide">
        <ChartCard
          title="Restarts against memory use"
          subtitle="One dot for each container with a memory limit"
          phase={phase}
          empty={empty}
          height="tall"
          legend={LEGEND}
          figure={
            ready
              ? {
                  // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n45, kept as its builder left it: its figure follows focus, built before figure-readout
                  value: focus.readout(f.number(s.loops), (d) => f.number(d.restarts)),
                  unit: focus.readout(
                    s.loops === 1 ? 'container in a restart loop' : 'containers in a restart loop',
                    (d) => (d.restarts === 1 ? 'restart' : 'restarts'),
                  ),
                  period: focus.readout(
                    `of ${f.number(s.rows.length)} containers on ${f.number(s.hosts)} hosts`,
                    (d) => `in 7 days, on ${d.host}`,
                  ),
                  status: focus.readout(restFlag, flagOf),
                }
              : { value: null }
          }
          footer={
            ready
              ? [
                  { label: 'No limit, not drawn', value: f.number(s.noLimit) },
                  since === null
                    ? null
                    : { label: 'Loop began, UTC', value: clock(since), mono: true },
                ]
              : undefined
          }
          chart={(box) => (
            <CartesianChart
              label="Restarts in the last 7 days against peak memory in percent of the limit, one dot for each container with a limit"
              summary={`${s.plotted.length} containers; the names of those past a line are on the plot`}
              height={box.height}
              data={s.plotted}
              focus={focus}
              tooltip={false}
              x={{
                value: (d) => d.peakPct ?? 0,
                domain: [0, 105],
                title: 'Peak memory, % of limit, last 24 h',
              }}
              y={{ title: 'Restarts, last 7 days', domain: [0, RESTART_CAP] }}
              zones={[
                {
                  axis: 'x',
                  from: NEAR,
                  to: 105,
                  fill: alpha(BASALT.bad, 0.08),
                  label: `Near, ${NEAR}%+`,
                },
              ]}
              refLines={[
                {
                  axis: 'x',
                  value: 100,
                  color: CONTAINER_SERIES.rule,
                  dashed: true,
                  label: 'Limit',
                },
                {
                  value: OFTEN,
                  color: CONTAINER_SERIES.rule,
                  dashed: true,
                  label: `Often, ${OFTEN}+ restarts`,
                },
              ]}
              series={[
                {
                  mark: 'dot',
                  key: 'quiet',
                  label: 'Within both lines',
                  color: CONTAINER_SERIES.quiet,
                  legend: false,
                  y: (d) => (d.flagged ? null : d.restarts),
                },
                {
                  mark: 'dot',
                  key: 'flagged',
                  label: 'Past a line',
                  color: CONTAINER_SERIES.flagged,
                  legend: false,
                  y: (d) => (d.flagged ? d.restarts : null),
                },
              ]}
              // cycle-expression-11: a dot series has no direct-label prop, so the names of the containers past a line are a text mark placed by chartLabels
              marks={CartesianChart.custom<Row>((plot) => {
                const r = BASALT.dotR + 1
                const py = (d: Row): number => plot.y(Math.min(d.restarts, RESTART_CAP))
                const dots = plot.data.flatMap((d) => {
                  const px = plot.x(d.peakPct ?? 0)
                  return px === null
                    ? []
                    : [{ left: px - r, top: py(d) - r, width: 2 * r, height: 2 * r }]
                })
                const named = new Map(
                  plot
                    .rows('flagged')
                    .filter((d) => d.flagged)
                    .map((d) => [d.id, d]),
                )
                const { placed } = chartLabels.place(
                  [...named.values()].map((d) => ({
                    key: d.id,
                    text: d.name,
                    x: plot.x(d.peakPct ?? 0) ?? 0,
                    y: py(d),
                    priority: d.loop ? 2 : d.restarts,
                  })),
                  { width: plot.plotWidth, height: plot.plotHeight },
                  { obstacles: dots, gap: BASALT.dotR + 3 },
                )
                const labelsAt = (rows: typeof placed, fill: string) =>
                  text(rows, {
                    x: (l) => named.get(l.key)?.peakPct ?? 0,
                    y: (l) => Math.min(named.get(l.key)?.restarts ?? 0, RESTART_CAP),
                    text: (l) => l.text,
                    dx: (l) => l.dx,
                    dy: (l) => l.dy,
                    anchor: (l) => l.textAnchor,
                    fill,
                    fontSize: BASALT.text.micro,
                  })
                // The text mark takes one fill, so a focused item's neighbours are a second mark in a dimmed ink.
                const dim = (l: (typeof placed)[number]): boolean =>
                  plot.focused !== null && plot.focused.id !== l.key
                return [
                  labelsAt(
                    placed.filter((l) => !dim(l)),
                    BASALT.ink,
                  ),
                  labelsAt(placed.filter(dim), alpha(BASALT.ink, 0.35)),
                ]
              })}
            />
          )}
        />
        <DataPanel
          title="Containers"
          subtitle="Worst first: restarts, then peak memory"
          phase={phase}
          bodySize={{ rows: 11 }}
          body={() => <DataTable table={table} focus={focus} height="fill" />}
        />
      </CardGrid>
    </Page>
  )
}
