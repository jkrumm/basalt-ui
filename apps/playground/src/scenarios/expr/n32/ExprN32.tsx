import { StatCard } from 'basalt-ui/cards'
import type { Empty, Phase, Verdict } from 'basalt-ui/cards'
import { useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import type { ScenarioProps } from '../../shot-state'
import { isPlanFixture, planIssues, STATE_LABELS } from './fixture'
import type { IssueState, PlanIssue } from './fixture'

const c = col<PlanIssue>()

// Only a running build earns a hue; waiting is the common state and stays neutral.
const STATE_TONE: Readonly<Record<IssueState, Verdict['tone']>> = {
  building: 'info',
  queued: 'neutral',
  waiting: 'neutral',
}

// Literal classes so Tailwind sees each step; deeper chains share the last one.
const INDENT = ['pl-0', 'pl-4', 'pl-8', 'pl-12', 'pl-16'] as const

const columns = (topId: number | undefined) => [
  // cycle-expression-8: the kit has no tree or nested-rows form, so the plan tree is one custom
  // column that indents each dependent under the Issue it waits on.
  c.custom('issue', {
    header: 'Issue',
    sortValue: (row) => row.order,
    card: 'title',
    priority: 1,
    render: (row) => (
      <div className={`flex min-w-0 flex-col ${INDENT[Math.min(row.depth, INDENT.length - 1)]}`}>
        <span>
          {row.depth > 0 ? '↳ ' : ''}
          {row.title}
        </span>
        <span className="font-mono text-muted-foreground">
          {`#${row.id} · ${row.project}`}
          {row.alsoWaitsOn === '' ? '' : ` · also waits on ${row.alsoWaitsOn}`}
        </span>
        {row.id === topId ? (
          <span className="font-medium">Ships first: unblocks the most</span>
        ) : null}
      </div>
    ),
  }),
  c.status('state', {
    header: 'State',
    priority: 2,
    options: ['building', 'queued', 'waiting'] as const,
    labels: STATE_LABELS,
    tone: (state) => STATE_TONE[state],
    filter: 'multi',
  }),
  c.number('unblocks', { header: 'Unblocks', priority: 2 }),
]

const verdictOf = (row: PlanIssue): Verdict => ({
  tone: STATE_TONE[row.state],
  label: STATE_LABELS[row.state],
})

const nameOf = (row: PlanIssue): string => `#${row.id} ${row.title}`

function phaseOf(shotState: ScenarioProps['shotState']): Phase {
  if (shotState === 'loading') return 'loading'
  if (shotState === 'error') {
    return {
      tag: 'error',
      message: 'The plan service did not answer within 10 s.',
      retry: () => window.location.reload(),
    }
  }
  return 'ready'
}

export function ExprN32Scenario({ shotState, fixture }: ScenarioProps) {
  const issues =
    shotState === 'empty' ? [] : planIssues(isPlanFixture(fixture) ? fixture : undefined)
  const phase = phaseOf(shotState)
  // The tree lists the Issue with the most waiting on it first.
  const top = issues[0]?.unblocks ? issues[0] : undefined
  const waiting = issues.filter((i) => i.waitsOn.length > 0).length

  const focus = useChartFocus(issues, {
    announce: (d) =>
      `${nameOf(d)}: ${d.unblocks} waiting on it, ${d.direct} directly, ${STATE_LABELS[d.state]}`,
  })

  const planEmpty: Empty | null =
    issues.length === 0 ? { cause: 'No open Issues. Queue one with factory issue new.' } : null

  const table = useDataTable({
    id: 'plan-issues',
    label: 'Open Issues',
    columns: columns(top?.id),
    data: issues,
    phase,
    empty: planEmpty,
    getRowId: (row) => String(row.id),
    mode: { kind: 'client' },
  })

  return (
    <Page area="expr-n32">
      <PageBar title="Plan waits" />
      <StatCard
        title="Unblocks the most"
        phase={phase}
        value={focus.readout(issues.length === 0 ? null : (top?.unblocks ?? 0), (d) => d.unblocks)}
        unit="Issues wait on it"
        status={focus.readout(top && verdictOf(top), verdictOf)}
        sub={focus.readout(top ? nameOf(top) : undefined, nameOf)}
        subMono
        footer={[
          { label: 'Directly', value: focus.readout(top?.direct ?? 0, (d) => d.direct) },
          {
            label: 'Through others',
            value: focus.readout(top ? top.unblocks - top.direct : 0, (d) => d.unblocks - d.direct),
          },
        ]}
      />
      <Section
        title="Open Issues"
        summary={
          phase === 'ready' && issues.length > 0
            ? `${waiting} of ${issues.length} wait on another`
            : ''
        }
      >
        <DataTable table={table} focus={focus} />
      </Section>
      {focus.live}
    </Page>
  )
}
