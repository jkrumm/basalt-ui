/**
 * Dogfood cycle 2 (docs/v3/cycles/dogfood-2.md): the factory console's overview slice rebuilt on
 * v3's published surface after cycle 1's fixes. The console's Flow page gives the stat row
 * (`StatRow`, four `StatCard`s), the Issues with their project, origin and state filters, and the
 * peek beside them; its Throughput page gives the one chart card (`TimeChart` in a card).
 * `?screen=` switches every frame to one phase for the shots. Every workaround carries a
 * `cycle-dogfood-2:` comment naming its finding.
 */
import type { Phase } from 'basalt-ui/cards'
import { StatCard } from 'basalt-ui/cards'
import { ChartCard, Lines, Sparkline } from 'basalt-ui/charts'
import { filterSlot, spec } from 'basalt-ui/controls'
import { CardGrid, EmptyState, Facts, Page, PageAside, PageBar, Section } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import type { ComponentProps, ReactElement } from 'react'
import { DEMO_SERIES } from '../../demo/series'
import {
  FLOW_ISSUES,
  FLOW_NOW,
  FLOW_STATES,
  FLOW_STATS,
  FLOW_TREND,
  ORIGIN_LABELS,
  STATE_LABELS,
} from '../dogfood-1/flow-fixtures'
import type { FlowIssue, FlowStat, FlowState } from '../dogfood-1/flow-fixtures'
import { flow } from './flow-store'
import type { Screen } from './flow-store'
import { STAT_ICON } from './stat-icons'

function phaseOf(screen: Screen): Phase {
  if (screen === 'loading') return 'loading'
  if (screen === 'stale') return 'stale'
  if (screen === 'error')
    return { tag: 'error', message: 'The factory did not answer', retry: () => undefined }
  return 'ready'
}

// ---- Stat row ----------------------------------------------------------------------------------

// cycle-dogfood-2: dogfood-2.1 — `Delta`, the type `StatCard delta` names, is exported by no
// published subpath (known: wiring-3.2, filed as v3-wiring-3-api), so the page reads it off the props.
type Delta = NonNullable<ComponentProps<typeof StatCard>['delta']>

function deltaOf({ delta: { value, higherIsBetter } }: FlowStat): Delta {
  return {
    value: value > 0 ? `+${value}` : String(value),
    polarity: value === 0 ? 'neutral' : higherIsBetter ? 'up-good' : 'up-bad',
  }
}

function StatRow({ phase }: { phase: Phase }): ReactElement {
  const [, setState] = flow.field.state.use()
  return (
    <CardGrid min="narrow" narrow="scroll">
      {FLOW_STATS.map((stat) => {
        const show = (): void => setState(stat.key === 'shipped' ? 'done' : stat.key)
        // cycle-dogfood-2: dogfood-2.4 — the Queued card's bars draw as a line (no bar form on
        // Sparkline), and the Working line's planned samples draw as past (no `futureFrom`).
        const values = stat.series?.values ?? stat.bars?.values ?? []
        return (
          <StatCard
            key={stat.key}
            icon={STAT_ICON[stat.key]}
            title={stat.title}
            subtitle={stat.subtitle}
            value={stat.value}
            delta={deltaOf(stat)}
            sub={stat.sub}
            phase={phase}
            chart={(box) => (
              <Sparkline
                label={`${stat.title}, ${values.length} samples, latest ${values.at(-1) ?? 0}`}
                points={values}
                height={box.height}
                {...(stat.series?.target === undefined ? {} : { reference: stat.series.target })}
              />
            )}
            axisLabels={stat.axisLabels}
            footer={stat.footer}
            onClick={show}
            menu={[
              { id: 'issues', label: 'Show these Issues', onClick: show },
              { id: 'throughput', label: 'Open Throughput', href: '#throughput' },
            ]}
          />
        )
      })}
    </CardGrid>
  )
}

// ---- Chart card --------------------------------------------------------------------------------

const LATEST = FLOW_TREND.at(-1)

function InFlightChart({ phase }: { phase: Phase }): ReactElement {
  return (
    <ChartCard
      title="In flight per day"
      subtitle="Working, waiting and queued Issues, last 14 days"
      figure={{
        value: LATEST ? LATEST.working + LATEST.waiting + LATEST.queued : null,
        unit: 'Issues',
        period: 'today',
      }}
      phase={phase}
      height="short"
      chart={(box) => (
        <Lines
          label="Working, waiting and queued Issues per day, last 14 days"
          data={FLOW_TREND}
          height={box.height}
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

const STATE_TONE: Record<FlowState, 'good' | 'warn' | 'info' | 'accent' | 'neutral'> = {
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
  c.entity('title', { header: 'Title', priority: 1, sub: (row) => row.reason }),
  c.text('project', { header: 'Project', priority: 2 }),
  c.status('state', {
    header: 'State',
    options: FLOW_STATES,
    labels: STATE_LABELS,
    tone: (value) => STATE_TONE[value],
    priority: 1,
  }),
  c.text('kind', { header: 'Kind', priority: 3 }),
  // cycle-dogfood-2: dogfood-2.11 — `c.text` takes no labels, so the origin label is a mapped field.
  c.text('originLabel', { header: 'Origin', priority: 3 }),
  c.relativeTime('since', { header: 'Age', priority: 2 }),
]

const clearFilters = (): void => {
  flow.field.project.clear()
  flow.field.origin.clear()
  flow.field.state.clear()
}

/** cycle-dogfood-2: dogfood-2.5 — the page filters the rows by its own store fields. */
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

function IssueFacts({ issue }: { issue: FlowIssue }): ReactElement {
  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="m-0 font-medium">{issue.title}</p>
      {issue.reason === null ? null : <p className="m-0 text-muted-foreground">{issue.reason}</p>}
      <Facts
        rows={[
          { label: 'State', value: STATE_LABELS[issue.state] },
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
  const rows = useIssues()
  const table = useDataTable<IssueRow>({
    id: 'cycle-dogfood-2-issues',
    label: 'Issues',
    columns,
    data: rows,
    getRowId: (row) => row.key,
    mode: { kind: 'client' },
    phase,
    now: FLOW_NOW,
    resetOn: [rows.length],
    empty: { cause: 'Nothing matches these filters.', filtered: { reset: clearFilters } },
    detail: (row) => <IssueFacts issue={row} />,
    detailTitle: (row) => (row.number === null ? 'Plan row' : `Issue ${refOf(row)}`),
    detailState: flow.field.issue,
  })
  return <DataTable table={table} height="auto" />
}

// ---- Page --------------------------------------------------------------------------------------

export function FlowOverview(): ReactElement {
  const [screen] = flow.field.screen.use()
  const phase = phaseOf(screen)

  if (screen === 'empty')
    return (
      <Page area="cycle-dogfood-2-flow">
        <PageBar title="Flow" />
        <EmptyState
          title="Nothing in flight"
          cause="Issues show here as they are filed and while they move."
        />
      </Page>
    )

  return (
    <Page area="cycle-dogfood-2-flow">
      <PageBar title="Flow" />
      <StatRow phase={phase} />
      <InFlightChart phase={phase} />
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
      {/* The table's detail shows in this aside (its DetailHost); `state` opens it on a deep link.
          cycle-dogfood-2: dogfood-2.2 — on a deep link the table clears `issue` from the URL while
          the aside keeps showing the Issue, and no row is marked; with or without `state` here. */}
      <PageAside title="Issue" state={flow.field.issue} mobile="sheet" />
    </Page>
  )
}
