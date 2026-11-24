/**
 * Dogfood cycle 3 (docs/v3/cycles/dogfood-3.md): the factory console's overview slice rebuilt on
 * v3's published surface after cycle 2's fixes, against the console's Flow page at software-factory
 * `d01dc74f`: the stat row (four `StatCard`s with their definitions), the "Issues over time" card
 * with its Count and Window choices, the Issues with their project, origin and state filters, and
 * the peek beside them. `?screen=` switches every frame to one phase for the shots. Every
 * workaround carries a `cycle-dogfood-3:` comment naming its finding.
 */
import { StatCard } from 'basalt-ui/cards'
import type { Delta, Phase } from 'basalt-ui/cards'
import { ChartCard, Lines, Sparkline } from 'basalt-ui/charts'
import { filterSlot, spec } from 'basalt-ui/controls'
import { CardGrid, EmptyState, Facts, Page, PageAside, PageBar, Section } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT } from 'basalt-ui/tokens'
import type { ReactElement } from 'react'
import {
  FLOW_ISSUES,
  FLOW_NOW,
  FLOW_STATES,
  FLOW_STATS,
  ORIGIN_LABELS,
  STATE_LABELS,
} from '../dogfood-1/flow-fixtures'
import type { FlowIssue, FlowStat, FlowState } from '../dogfood-1/flow-fixtures'
import { STAT_ICON } from '../dogfood-2/stat-icons'
import { cards, flow } from './flow-store'
import type { Screen } from './flow-store'
import { COUNT_DEFINITIONS, COUNT_LABELS, trendOf } from './trend-fixtures'

function phaseOf(screen: Screen): Phase {
  if (screen === 'loading') return 'loading'
  if (screen === 'stale') return 'stale'
  if (screen === 'error')
    return { tag: 'error', message: 'The factory did not answer', retry: () => undefined }
  return 'ready'
}

// ---- Stat row ----------------------------------------------------------------------------------

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
        // cycle-dogfood-3: dogfood-3.4 — the Queued card's bars draw as a line (no bar form on
        // Sparkline), and the Working line's planned samples draw as past (no `futureFrom`).
        const values = stat.series?.values ?? stat.bars?.values ?? []
        return (
          <StatCard
            key={stat.key}
            icon={STAT_ICON[stat.key]}
            title={stat.title}
            subtitle={stat.subtitle}
            {...(stat.key === 'shipped' ? {} : { info: COUNT_DEFINITIONS[stat.key] })}
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
  const [count] = cards.widget.trend.count.use()
  const [window] = cards.widget.trend.window.use()
  const buckets = trendOf(count, window)
  const word = COUNT_LABELS[count].toLowerCase()
  return (
    <ChartCard
      title="Issues over time"
      subtitle={`Issues, never sessions: the most at any instant of ${window === '30d' ? 'a day' : 'an hour'} and the average over it`}
      info={COUNT_DEFINITIONS[count]}
      controls={filterSlot([
        spec(cards.widget.trend.count, 'Count', { as: 'segmented' }),
        spec(cards.widget.trend.window, 'Window', { as: 'segmented' }),
      ])}
      figure={{
        value: Math.max(0, ...buckets.map((b) => b.peak)),
        period: `peak ${word} in the window`,
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

type IssueRow = FlowIssue & { ref: string }

const refOf = (issue: FlowIssue): string => (issue.number === null ? '' : `#${issue.number}`)
const ROWS: readonly IssueRow[] = FLOW_ISSUES.map((i) => ({ ...i, ref: refOf(i) }))

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
  c.text('origin', { header: 'Origin', priority: 3, labels: ORIGIN_LABELS }),
  c.status('state', {
    header: 'State',
    options: FLOW_STATES,
    labels: STATE_LABELS,
    tone: (value) => STATE_TONE[value],
    priority: 1,
  }),
  c.relativeTime('since', { header: 'Since', priority: 2 }),
]

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
  const table = useDataTable<IssueRow>({
    id: 'cycle-dogfood-3-issues',
    label: 'Issues',
    columns,
    data: ROWS,
    getRowId: (row) => row.key,
    mode: { kind: 'client' },
    phase,
    now: FLOW_NOW,
    filters: [
      { field: flow.field.project, match: (row, v) => row.project === v },
      { field: flow.field.origin, match: (row, v) => row.origin === v },
      { field: flow.field.state, match: (row, v) => row.state === v },
    ],
    // cycle-dogfood-3: dogfood-3.5 — with `filters` narrowing the rows to none, the table draws
    // "No rows match the current search and filters" (there is no search) and drops this cause.
    empty: { cause: 'Nothing matches these filters.' },
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
      <Page area="cycle-dogfood-3-flow">
        <PageBar title="Flow" />
        <EmptyState
          title="Nothing in flight"
          cause="Issues show here as they are filed and while they move."
        />
      </Page>
    )

  return (
    <Page area="cycle-dogfood-3-flow">
      <PageBar title="Flow" />
      <StatRow phase={phase} />
      <TrendCard phase={phase} />
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
      <PageAside title="Issue" state={flow.field.issue} mobile="sheet" />
    </Page>
  )
}
