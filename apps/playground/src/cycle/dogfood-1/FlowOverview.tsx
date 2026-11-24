/**
 * Dogfood cycle 1 (docs/v3/cycles/dogfood-1.md): the factory console's overview slice rebuilt on
 * v3's published surface. The console's Flow page gives the stat row (`StatRow`, four `StatCard`s),
 * the Issues with their project, origin and state filters, and the peek beside them; its Throughput
 * page gives the one chart card (`TimeChart` in a card). `?screen=` switches every frame to one
 * phase for the shots. Every workaround carries a `cycle-dogfood-1:` comment naming its finding.
 */
import type { ControlHandle } from 'basalt-ui/router'
import { StatCard } from 'basalt-ui/cards'
import { ChartCard, Lines, Sparkline } from 'basalt-ui/charts'
import { filterSlot, spec } from 'basalt-ui/controls'
import { CardGrid, EmptyState, Facts, Page, PageAside, PageBar, Section } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import type { ComponentProps, ReactElement, ReactNode } from 'react'
import { DEMO_SERIES } from '../../demo/series'
import {
  FLOW_ISSUES,
  FLOW_NOW,
  FLOW_STATS,
  FLOW_TREND,
  ORIGIN_LABELS,
  STATE_LABELS,
} from './flow-fixtures'
import type { FlowIssue, FlowStat, FlowState } from './flow-fixtures'
import { flow } from './flow-store'
import type { Screen } from './flow-store'

// ---- Icons: the console's Phosphor glyphs (RocketLaunch, Hourglass, Queue, CheckCircle) --------

function glyph(paths: ReactNode): (props: { className?: string }) => ReactElement {
  return function StatGlyph({ className }) {
    return (
      <svg
        viewBox="0 0 24 24"
        className={className}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {paths}
      </svg>
    )
  }
}

const STAT_ICON: Record<FlowStat['key'], (props: { className?: string }) => ReactElement> = {
  working: glyph(<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M14 4c3-1 6-1 6-1s0 3-1 6l-7 7-5-5z" />),
  waiting: glyph(<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9" />),
  queued: glyph(<path d="M4 6h16M4 12h16M4 18h10" />),
  shipped: glyph(
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12 3 3 5-6" />
    </>,
  ),
}

// ---- Phase of the cycle's screen switch ---------------------------------------------------------

// cycle-dogfood-1: dogfood-1.4 — `Phase` and `QueryStateLike` are named by the shipped rules but
// exported by no subpath, so the page reads the type off a frame's props.
type Phase = Exclude<NonNullable<ComponentProps<typeof StatCard>['phase']>, { isPending: boolean }>

function phaseOf(screen: Screen): Phase {
  if (screen === 'loading') return 'loading'
  if (screen === 'stale') return 'stale'
  if (screen === 'error')
    return { tag: 'error', message: 'The factory did not answer', retry: () => undefined }
  return 'ready'
}

// ---- Stat row ----------------------------------------------------------------------------------

/** The plot (56 px) and its start, now and end labels (16 px) inside the card's 72 px box. */
function StatTrend({ stat }: { stat: FlowStat }): ReactElement {
  const values = stat.series?.values ?? stat.bars?.values ?? []
  return (
    <div className="h-full">
      {/* cycle-dogfood-1: dogfood-1.15 — the Working line has no future segment (`futureFrom`):
          the Sparkline draws Thu 12:00 and Fri 00:00 as past samples. dogfood-1.5 is closed by
          `axisLabels`; the bar variant draws as a line (`MiniBars` is not exported). */}
      <Sparkline
        label={`${stat.title}, ${values.length} samples, latest ${values.at(-1) ?? 0}`}
        points={values}
        height="fill"
        axisLabels={stat.axisLabels}
        {...(stat.series?.target === undefined ? {} : { reference: stat.series.target })}
      />
    </div>
  )
}

function deltaOf(stat: FlowStat) {
  const { value, higherIsBetter } = stat.delta
  return {
    value: value > 0 ? `+${value}` : String(value),
    polarity:
      value === 0
        ? ('neutral' as const)
        : higherIsBetter
          ? ('up-good' as const)
          : ('up-bad' as const),
  }
}

function StatRow({ phase }: { phase: Phase }): ReactElement {
  const [, setState] = flow.field.state.use()
  return (
    <CardGrid min="narrow">
      {FLOW_STATS.map((stat) => (
        <StatCard
          key={stat.key}
          icon={STAT_ICON[stat.key]}
          title={stat.title}
          subtitle={stat.subtitle}
          value={stat.value}
          delta={deltaOf(stat)}
          sub={stat.sub}
          phase={phase}
          chart={() => <StatTrend stat={stat} />}
          footer={stat.footer}
          onClick={() => setState(stat.key === 'shipped' ? 'done' : stat.key)}
          menu={[
            {
              id: 'issues',
              label: 'Show these Issues',
              onClick: () => setState(stat.key === 'shipped' ? 'done' : stat.key),
            },
            { id: 'throughput', label: 'Open Throughput', href: '#throughput' },
          ]}
        />
      ))}
    </CardGrid>
  )
}

// ---- Chart card --------------------------------------------------------------------------------

function InFlightChart({ screen }: { screen: Screen }): ReactElement {
  const latest = FLOW_TREND.at(-1)
  const total = latest ? latest.working + latest.waiting + latest.queued : 0
  return (
    <ChartCard
      title="In flight per day"
      subtitle="Working, waiting and queued Issues, last 14 days"
      figure={{ value: String(total), unit: 'Issues', period: 'today' }}
      phase={phaseOf(screen)}
      chart={() => (
        <Lines
          label="Working, waiting and queued Issues per day, last 14 days"
          data={FLOW_TREND}
          x={{ value: (d) => d.day }}
          series={[
            {
              mark: 'line',
              key: 'working',
              label: 'Working',
              color: DEMO_SERIES.sessions,
              y: (d) => d.working,
            },
            {
              mark: 'line',
              key: 'waiting',
              label: 'Waiting',
              color: DEMO_SERIES.revenue,
              y: (d) => d.waiting,
            },
            {
              mark: 'line',
              key: 'queued',
              label: 'Queued',
              color: DEMO_SERIES.signups,
              y: (d) => d.queued,
            },
          ]}
        />
      )}
    />
  )
}

// ---- Issue table -------------------------------------------------------------------------------

type IssueRow = FlowIssue & { ref: string; originLabel: string }

const refOf = (issue: FlowIssue): string => (issue.number === null ? '' : `#${issue.number}`)

const STATE_TONE: Record<FlowState, 'good' | 'warn' | 'bad' | 'info' | 'accent' | 'neutral'> = {
  settling: 'neutral',
  queued: 'neutral',
  working: 'accent',
  waiting: 'warn',
  watching: 'info',
  done: 'good',
}

const c = col<IssueRow>()
const columns = [
  c.text('ref', { header: 'Issue', priority: 1 }),
  // cycle-dogfood-1: dogfood-1.3 — `sub` shares the title's line and truncates the title.
  c.entity('title', { header: 'Title', priority: 1, sub: (row) => row.reason }),
  c.text('project', { header: 'Project', priority: 2 }),
  // cycle-dogfood-1: dogfood-1.10 — the cell prints the raw option (`working`); no labels.
  c.status('state', {
    header: 'State',
    options: ['settling', 'queued', 'working', 'waiting', 'watching', 'done'],
    tone: (value) => STATE_TONE[value],
    priority: 1,
  }),
  c.text('kind', { header: 'Kind', priority: 3 }),
  c.text('originLabel', { header: 'Origin', priority: 3 }),
  // cycle-dogfood-1: dogfood-1.6 — ages read the mount-time `Date.now()`, never `FLOW_NOW`.
  c.relativeTime('since', { header: 'Age', priority: 2 }),
]

/**
 * cycle-dogfood-1: dogfood-1.2 — the page filters the rows itself, and the table cannot learn that
 * filters are on: an empty result says "No rows yet" and offers no Clear filters.
 */
function useIssues(): IssueRow[] {
  const [project] = flow.field.project.use()
  const [origin] = flow.field.origin.use()
  const [state] = flow.field.state.use()
  return FLOW_ISSUES.filter(
    (i) =>
      (project === 'all' || i.project === project) &&
      (origin === 'all' || i.origin === origin) &&
      (state === 'all' || i.state === state),
  ).map((i) => ({ ...i, ref: refOf(i), originLabel: ORIGIN_LABELS[i.origin] }))
}

function IssueTable({ phase }: { phase: Phase }): ReactElement {
  const [issue, setIssue] = flow.field.issue.use()
  const rows = useIssues()
  const table = useDataTable<IssueRow>({
    id: 'cycle-dogfood-issues',
    label: 'Issues',
    columns,
    data: rows,
    getRowId: (row) => row.key,
    mode: { kind: 'client' },
    phase,
    resetOn: [rows.length],
    // cycle-dogfood-1: dogfood-1.12 — the row's detail cannot reach the page's PageAside
    // (shell-1.1, filed as v3-shell-1-detail-host), so the row writes the URL field.
    onRowActivate: (row) => setIssue(row.key),
    // the URL field names the open row, so a share link and Back mark it too (1541, activeRowId)
    activeRowId: issue,
  })
  return <DataTable table={table} height="auto" />
}

// ---- Aside -------------------------------------------------------------------------------------

/**
 * cycle-dogfood-1: dogfood-1.12 — `PageAside state` takes a `ControlHandle<boolean>` and the open
 * Issue is a string field (shell-1.2, filed as v3-shell-1-api): open while it holds a key.
 */
function asideOf(handle: typeof flow.field.issue): ControlHandle<boolean> {
  return {
    key: handle.key,
    kind: 'boolean',
    isDefault: handle.isDefault,
    clear: () => handle.clear(),
    useSource: () => ({ source: 'own', inherited: undefined }),
    use: () => {
      const [value] = handle.use()
      return [value !== '', (open) => (open ? undefined : handle.clear())]
    },
  }
}

function IssueFacts({ issue }: { issue: FlowIssue }): ReactElement {
  const rows = [
    { label: 'State', value: STATE_LABELS[issue.state] },
    { label: 'Project', value: issue.project },
    { label: 'Kind', value: issue.kind },
    { label: 'Origin', value: ORIGIN_LABELS[issue.origin] },
    {
      label: 'Since',
      value: issue.since === null ? 'Not filed yet' : new Date(issue.since).toUTCString(),
    },
  ]
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="m-0 font-medium">{issue.title}</p>
      {issue.reason === null ? null : <p className="m-0 text-muted-foreground">{issue.reason}</p>}
      <Facts rows={rows} />
    </div>
  )
}

// ---- Page --------------------------------------------------------------------------------------

export function FlowOverview(): ReactElement {
  const [screen] = flow.field.screen.use()
  const [key] = flow.field.issue.use()
  const phase = phaseOf(screen)
  const open = FLOW_ISSUES.find((i) => i.key === key)

  if (screen === 'empty')
    return (
      <Page area="cycle-dogfood-flow">
        <PageBar title="Flow" />
        <EmptyState
          tier="page"
          cause="Nothing in flight. Issues show here as they are filed and while they move."
        />
      </Page>
    )

  return (
    <Page area="cycle-dogfood-flow">
      <PageBar title="Flow" />
      <StatRow phase={phase} />
      <InFlightChart screen={screen} />
      <Section
        title="Issues"
        summary={`As of ${new Date(FLOW_NOW).toUTCString()}`}
        controls={filterSlot([
          spec(flow.field.project, 'Project'),
          spec(flow.field.origin, 'Origin'),
          spec(flow.field.state, 'State'),
        ])}
      >
        <IssueTable phase={phase} />
      </Section>
      <PageAside
        title={
          open === undefined ? 'Issue' : open.number === null ? 'Plan row' : `Issue ${refOf(open)}`
        }
        state={asideOf(flow.field.issue)}
      >
        {open === undefined ? null : <IssueFacts issue={open} />}
      </PageAside>
    </Page>
  )
}
