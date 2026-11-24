import { useFormat } from 'basalt-ui'
import type { Format } from 'basalt-ui'
import type { Empty, Phase } from 'basalt-ui/cards'
import { text } from '@tanstack/charts/text'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { BASALT } from 'basalt-ui/tokens'
import { Facts, Page, PageBar } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { SCHEDULE_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { HORIZON_MS, NOW, jobsFor, type Horizon, type Job } from './fixture'

const c = col<Job>()

/** Clock time within the day ahead, the date beyond it. */
function clock(job: Job, format: Format): string {
  return job.nextRun - NOW <= HORIZON_MS
    ? format.time(job.nextRun)
    : format.dateTime(job.nextRun, 'short')
}

function when(job: Job, format: Format): string {
  return `${clock(job, format)}, ${format.relative(job.nextRun, NOW)}`
}

const HORIZON_LABELS = {
  next: 'Next run',
  soon: 'Within 24 h',
  later: 'Beyond 24 h',
} as const satisfies Record<Horizon, string>

// cycle-expression-4: the chart kit has no time-axis kind with a compressed tail, so the axis is a log scale of minutes with hand-named ticks
// x ticks on a log axis of minutes: the 24 h rule is one of them.
const TICKS = [1, 10, 60, 360, 1440, 10080, 43200] as const
const TICK_TEXT: Record<number, string> = {
  1: '1 min',
  10: '10 min',
  60: '1 h',
  360: '6 h',
  1440: '24 h',
  10080: '1 week',
  43200: '30 days',
}

type Label = { x: number; y: number; text: string; anchor: 'start' | 'end'; dx: number }

const shorten = (name: string): string => (name.length > 24 ? `${name.slice(0, 23)}…` : name)

function phaseOf(shotState: ScenarioProps['shotState']): Phase {
  if (shotState === 'loading') return 'loading'
  if (shotState === 'error') {
    return { tag: 'error', message: 'The scheduler did not answer.', retry: () => undefined }
  }
  return 'ready'
}

export function ExprN09Scenario({ shotState, fixture }: ScenarioProps) {
  const format = useFormat()
  const phase = phaseOf(shotState)
  const jobs = shotState === 'empty' ? [] : jobsFor(fixture)
  const empty: Empty | null =
    shotState === 'empty'
      ? { cause: 'No jobs are scheduled. Jobs appear here once a repo registers one.' }
      : null

  const focus = useChartFocus(jobs, {
    announce: (job) => `${job.name}, ${job.repo}, ${when(job, format)}`,
  })

  const columns = [
    c.entity('name', { header: 'Job', priority: 1 }),
    // cycle-expression-4: no kind prints clock time with its distance, or sets a value in the mono face
    c.custom('next', {
      header: 'Next run',
      render: (row, env) => <span className="font-mono tabular-nums">{when(row, env.format)}</span>,
      sortValue: (row) => row.nextRun,
      width: 30,
      card: 'meta',
      priority: 1,
    }),
    c.status('horizon', {
      header: 'Horizon',
      options: ['next', 'soon', 'later'],
      labels: HORIZON_LABELS,
      tone: (value) => (value === 'next' ? 'accent' : 'neutral'),
      priority: 2,
      card: 'badge',
    }),
    // cycle-expression-4: entity `sub` and text columns cannot take the mono face a repo name wants
    c.custom('repo', {
      header: 'Repo',
      render: (row) => <span className="font-mono">{row.repo}</span>,
      sortValue: (row) => row.repo,
      card: 'subtitle',
      priority: 2,
    }),
    c.text('recurrence', { header: 'Recurrence', priority: 2 }),
  ]

  const table = useDataTable({
    id: 'schedule',
    label: 'Scheduled jobs',
    columns,
    data: jobs,
    phase,
    now: NOW,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
    detail: (row) => (
      <Facts
        rows={[
          { label: 'Repo', value: row.repo },
          { label: 'Recurrence', value: row.recurrence },
          { label: 'Next run', value: when(row, format) },
        ]}
      />
    ),
    detailTitle: (row) => row.name,
  })

  const next = jobs[0]
  const beyond = jobs.filter((job) => job.nextRun - NOW > HORIZON_MS).length
  const within = jobs.length - beyond
  const known = shotState === undefined
  const top = Math.max(1, jobs.length) + 1.5
  const labels: Label[] = [
    ...(next === undefined
      ? []
      : [
          {
            x: next.minutes,
            y: 1,
            text: `${shorten(next.name)}, ${format.time(next.nextRun)}`,
            anchor: next.minutes > 1440 ? ('end' as const) : ('start' as const),
            dx: next.minutes > 1440 ? -10 : 10,
          },
        ]),
    { x: 1440, y: top, text: `${within} within 24 h`, anchor: 'end', dx: -8 },
    { x: 1440, y: top, text: `${beyond} beyond 24 h`, anchor: 'start', dx: 8 },
  ]
  const minutes = jobs.map((job) => job.minutes)

  return (
    <Page area="schedule">
      <PageBar title="Job schedule" />
      <div className="flex flex-col gap-4">
        <ChartCard
          title="Next run of every job"
          subtitle="All repos, by time from now"
          phase={phase}
          empty={empty}
          height="fill"
          figure={{
            // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n09, kept as its builder left it: its figure follows focus, built before figure-readout
            value: focus.readout(known && next !== undefined ? next.name : null, (job) => job.name),
            period: focus.readout(known && next !== undefined ? when(next, format) : '', (job) =>
              when(job, format),
            ),
          }}
          chart={() => (
            <CartesianChart
              height="fill"
              label="Next run of each job on a log time axis, 24 hours marked"
              data={jobs}
              focus={focus}
              tooltip={false}
              marks={CartesianChart.custom<Job>(() => [
                // cycle-expression-4: the kit has no direct-label mark for a datum, so the next run and both 24 h counts are engine text marks at data coordinates
                text(labels, {
                  x: (l: Label) => l.x,
                  y: (l: Label) => l.y,
                  text: (l: Label) => l.text,
                  anchor: (l: Label) => l.anchor,
                  dx: (l: Label) => l.dx,
                  fill: BASALT.ink,
                  fontSize: BASALT.text.xs,
                }),
              ])}
              x={{
                value: (job) => job.minutes,
                scale: 'log',
                domain: [Math.min(1, ...minutes) / 2, Math.max(...minutes) * 1.5],
                ticks: TICKS,
                format: (v) => TICK_TEXT[Number(v)] ?? '',
                title: 'Time from now, log scale',
              }}
              y={{ title: 'Run order', domain: [0, Math.max(1, jobs.length) + 3] }}
              refLines={[
                {
                  axis: 'x',
                  value: 1440,
                  color: SCHEDULE_SERIES.later,
                  dashed: true,
                  label: '24 h',
                },
              ]}
              series={(['next', 'soon', 'later'] as const).map((key) => ({
                mark: 'dot' as const,
                key,
                label: HORIZON_LABELS[key],
                color: SCHEDULE_SERIES[key],
                y: (job: Job) => (job.horizon === key ? job.order : null),
              }))}
            />
          )}
        />
        {shotState === 'empty' || shotState === 'error' ? null : (
          <DataTable table={table} focus={focus} />
        )}
      </div>
      {focus.live}
    </Page>
  )
}
