/**
 * Dogfood cycle 5 (docs/v3/cycles/dogfood-5.md): the factory console's Overview slice rebuilt on
 * v3's published surface after cycle 4's fixes, against software-factory `39022226`
 * (`routes/index.tsx`): the counts note, the stat row (four `StatCard`s with their definitions),
 * the "Issues over time" card with its Count and Window choices, the Issues with their project,
 * origin and state filters, and the open Issue in the page's aside. `?screen=` switches every frame
 * to one phase for the shots. Every workaround carries a `cycle-dogfood-5:` comment naming its
 * finding. The data is cycle 4's fixtures, in the console's shapes.
 */
import { StatCard } from 'basalt-ui/cards'
import type { Delta, Phase } from 'basalt-ui/cards'
import { ChartCard, Lines, Sparkline } from 'basalt-ui/charts'
import { filterSlot, spec } from 'basalt-ui/controls'
import {
  CardGrid,
  EmptyState,
  Facts,
  Page,
  PageAside,
  PageBar,
  PageSummary,
  Section,
} from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT } from 'basalt-ui/tokens'
import type { ReactElement } from 'react'
import { STAT_ICON } from './stat-icons'
import {
  COUNT_LABELS,
  DEFINITIONS,
  FLOW_NOW,
  ORIGIN_LABELS,
  OVERVIEW_ISSUES,
  OVERVIEW_STATS,
  WORK_LABELS,
  WORK_STATES,
  trendOf,
} from './overview-fixtures'
import type { OverviewIssue, OverviewStat, WorkState } from './overview-fixtures'
import { overview } from './overview-store'
import type { Screen } from './overview-store'

function phaseOf(screen: Screen): Phase {
  if (screen === 'loading') return 'loading'
  if (screen === 'stale') return 'stale'
  if (screen === 'error')
    return { tag: 'error', message: 'The factory did not answer', retry: () => undefined }
  return 'ready'
}

// ---- Stat row ----------------------------------------------------------------------------------

/** The console's Phosphor glyphs, under the cards they now head. */
const ICON = {
  running: STAT_ICON.working,
  paused: STAT_ICON.waiting,
  notStarted: STAT_ICON.queued,
  shipped: STAT_ICON.shipped,
} as const

function deltaOf({ delta: { value, higherIsBetter } }: OverviewStat): Delta {
  return {
    value: value > 0 ? `+${value}` : String(value),
    polarity: value === 0 ? 'neutral' : higherIsBetter ? 'up-good' : 'up-bad',
  }
}

function StatRow({ phase }: { phase: Phase }): ReactElement {
  const [, setState] = overview.field.state.use()
  return (
    <CardGrid min="narrow" narrow="scroll">
      {OVERVIEW_STATS.map((stat) => {
        // cycle-dogfood-5: dogfood-5.3 — Shipped's bars draw as a line: Sparkline has no bar form.
        const values = stat.series ?? stat.bars ?? []
        return (
          <StatCard
            key={stat.key}
            icon={ICON[stat.key]}
            title={stat.title}
            subtitle={stat.subtitle}
            info={DEFINITIONS[stat.key]}
            value={stat.value}
            delta={deltaOf(stat)}
            sub={stat.sub}
            phase={phase}
            chart={(box) => (
              <Sparkline
                label={`${stat.title}, ${values.length} samples, latest ${values.at(-1) ?? 0}`}
                points={values}
                height={box.height}
                form="area"
              />
            )}
            axisLabels={stat.axisLabels}
            footer={stat.footer}
            onClick={() => setState(stat.state ?? 'all')}
          />
        )
      })}
    </CardGrid>
  )
}

// ---- Chart card --------------------------------------------------------------------------------

/** The console's pair: the peak in the accent, the average as a neutral line over its fill. */
const PEAK = { light: BASALT.brand, dark: BASALT.brand }
const AVERAGE = { light: BASALT.inkFaint, dark: BASALT.inkFaint }

function TrendCard({ phase }: { phase: Phase }): ReactElement {
  const [count] = overview.widget.issuesOverTime.count.use()
  const [window] = overview.widget.issuesOverTime.window.use()
  const buckets = trendOf(count, window)
  return (
    <ChartCard
      title="Issues over time"
      subtitle={`Issues, never sessions: the most at any instant of ${window === '30d' ? 'a day' : 'an hour'} and the average over it`}
      info={DEFINITIONS[count]}
      controls={filterSlot([
        spec(overview.widget.issuesOverTime.count, 'Count', { as: 'segmented' }),
        spec(overview.widget.issuesOverTime.window, 'Window', { as: 'segmented' }),
      ])}
      figure={{
        value: Math.max(0, ...buckets.map((b) => b.peak)),
        period: `peak ${COUNT_LABELS[count].toLowerCase()} in the window`,
      }}
      phase={phase}
      height="short"
      chart={(box) => (
        <Lines
          label={`${COUNT_LABELS[count]} Issues, peak and average per bucket`}
          data={buckets}
          height={box.height}
          x={{ value: (b) => b.at }}
          naming="legend"
          series={[
            {
              mark: 'line',
              key: 'avg',
              label: 'Average',
              color: AVERAGE,
              area: 'fade',
              weight: 'quiet',
              y: (b) => b.avg,
            },
            { mark: 'line', key: 'peak', label: 'Peak', color: PEAK, y: (b) => b.peak },
          ]}
        />
      )}
    />
  )
}

// ---- Issue table -------------------------------------------------------------------------------

type IssueRow = OverviewIssue & { ref: string }

const refOf = (issue: OverviewIssue): string => (issue.number === null ? '' : `#${issue.number}`)
const ROWS: readonly IssueRow[] = OVERVIEW_ISSUES.map((i) => ({ ...i, ref: refOf(i) }))

/** `LOZENGE_TONES`: decided here, never derived from the word. */
const STATE_TONE: Record<WorkState, 'warn' | 'accent' | 'neutral'> = {
  running: 'accent',
  paused: 'warn',
  ready: 'neutral',
  held: 'neutral',
  checking: 'accent',
  closed: 'neutral',
}

const c = col<IssueRow>()
const columns = [
  c.text('ref', { header: 'Issue', priority: 1 }),
  c.entity('title', { header: 'Title', priority: 1, sub: (row) => row.reason }),
  c.text('project', { header: 'Project', priority: 2 }),
  c.text('origin', { header: 'Origin', priority: 3, labels: ORIGIN_LABELS }),
  c.status('state', {
    header: 'State',
    options: WORK_STATES,
    labels: WORK_LABELS,
    tone: (value) => STATE_TONE[value],
    priority: 1,
  }),
  c.relativeTime('since', { header: 'Since', priority: 2 }),
]

function IssueFacts({ issue }: { issue: OverviewIssue }): ReactElement {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="m-0 font-medium">{issue.title}</p>
      {issue.reason === null ? null : <p className="m-0 text-muted-foreground">{issue.reason}</p>}
      <Facts
        rows={[
          { label: 'State', value: WORK_LABELS[issue.state] },
          { label: 'Project', value: issue.project },
          { label: 'Kind', value: issue.kind },
          { label: 'Origin', value: ORIGIN_LABELS[issue.origin] },
          {
            label: 'Since',
            value: issue.since === null ? 'Not filed yet' : new Date(issue.since).toUTCString(),
          },
        ]}
      />
    </div>
  )
}

function IssueTable({ phase }: { phase: Phase }): ReactElement {
  const table = useDataTable<IssueRow>({
    id: 'cycle-dogfood-5-issues',
    label: 'Issues',
    columns,
    data: ROWS,
    getRowId: (row) => row.key,
    mode: { kind: 'client' },
    phase,
    now: FLOW_NOW,
    filters: [
      { field: overview.field.project, match: (row, v) => row.project === v },
      { field: overview.field.origin, match: (row, v) => row.origin === v },
      { field: overview.field.state, match: (row, v) => row.state === v },
    ],
    empty: { cause: 'No Issue matches this filter.' },
    detail: (row) => <IssueFacts issue={row} />,
    detailTitle: (row) => (row.number === null ? 'Plan row' : `Issue ${refOf(row)}`),
    detailState: overview.field.issue,
  })
  return <DataTable table={table} height="auto" />
}

// ---- Page --------------------------------------------------------------------------------------

const OPEN = OVERVIEW_ISSUES.filter((i) => i.state !== 'closed').length
const CLOSED = OVERVIEW_ISSUES.length - OPEN

export function Overview(): ReactElement {
  const [screen] = overview.field.screen.use()
  const phase = phaseOf(screen)
  // The counts exist only once the data does: in loading and error a real query has none.
  const note =
    screen === 'ready' || screen === 'stale'
      ? `${OPEN} open, ${CLOSED} closed in the last day`
      : undefined

  if (screen === 'empty')
    return (
      <Page area="cycle-dogfood-5-overview">
        <PageBar title="Overview" />
        <EmptyState
          title="Nothing in flight"
          cause="Issues show here as they are filed and while they move."
        />
      </Page>
    )

  return (
    <Page area="cycle-dogfood-5-overview">
      <PageBar title="Overview" />
      <PageSummary sentence={note} phase={phase} />
      <StatRow phase={phase} />
      <TrendCard phase={phase} />
      <Section
        title="Issues"
        summary={`As of ${new Date(FLOW_NOW).toUTCString()}`}
        controls={filterSlot([
          spec(overview.field.project, 'Project'),
          spec(overview.field.origin, 'Origin'),
          spec(overview.field.state, 'State'),
        ])}
      >
        <IssueTable phase={phase} />
      </Section>
      <PageAside title="Issue" state={overview.field.issue} mobile="sheet" />
    </Page>
  )
}
