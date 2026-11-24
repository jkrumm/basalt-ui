import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { BarList, DataPanel, StatCard } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { Sparkline, useChartFocus } from 'basalt-ui/charts'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import type { ScenarioProps } from '../../shot-state'
import { LATE_HOURS, STATES, issuesFor } from './fixture'
import type { Issue, State } from './fixture'

type Row = Issue & { shown: State | 'late'; days: number }

const STATE_WORD: Readonly<Record<State | 'late', string>> = {
  running: 'Running',
  checking: 'Checking',
  ready: 'Ready',
  paused: 'Paused',
  held: 'Held',
  late: 'Held, late',
}

/** The wait the meter and the line scale to, in days. */
const CAP_DAYS = 30

const HEAD = {
  issue: 'Issue',
  id: 'Id',
  state: 'State',
  wait: 'Waiting (days)',
  kind: 'Kind',
  origin: 'Origin',
  attempts: 'Attempts',
}

const c = col<Row>()
const columnsFor = (max: number) => [
  c.entity('title', { header: HEAD.issue, priority: 1 }),
  c.entity('id', { header: HEAD.id, mono: true, priority: 3, width: 'content', card: 'meta' }),
  c.status('shown', {
    header: HEAD.state,
    options: [...STATES, 'late'],
    labels: STATE_WORD,
    tone: (s) => (s === 'late' ? 'bad' : 'neutral'),
    priority: 1,
  }),
  // cycle-expression-13: Meter has no off-scale clamp as Sparkline cap does, so the cap is mine; the true value stays in the readout
  c.meter('days', { header: HEAD.wait, priority: 2, max: Math.min(max, CAP_DAYS) }),
  c.text('kind', { header: HEAD.kind, labels: { feat: 'Feature', fix: 'Fix', chore: 'Chore' } }),
  c.text('origin', { header: HEAD.origin }),
  c.number('attempts', { header: HEAD.attempts, digits: 0 }),
]

const noop = (): void => undefined

const toRow = (issue: Issue): Row => ({
  ...issue,
  shown: issue.state === 'held' && issue.waitHours >= LATE_HOURS ? 'late' : issue.state,
  days: Math.round((issue.waitHours / 24) * 10) / 10,
})

export function ExprN61Scenario({ shotState, fixture }: ScenarioProps) {
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The Issue list did not respond.' }
        : 'ready'
  const ready = phase === 'ready'
  const rows = ready && shotState !== 'empty' ? issuesFor(fixture).map(toRow) : []
  const nothing = ready && rows.length === 0
  const longest = rows[0]
  const late = rows.filter((r) => r.shown === 'late').length
  const running = rows.filter((r) => r.state === 'running').length
  const focus = useChartFocus(rows, {
    announce: (r) =>
      `${r.id}, ${r.title}: ${STATE_WORD[r.shown]}, ${r.days} days, ${r.attempts} attempts`,
    announceSpan: (run) => `${run.length} in ${STATE_WORD[run[0]?.state ?? 'ready'].toLowerCase()}`,
  })
  const table = useDataTable({
    id: 'open-issues',
    label: 'Work list',
    columns: columnsFor(longest?.days ?? 1),
    data: rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: 14,
  })
  return (
    <Page area="open-work">
      <PageBar title="Open work in argo" />
      <CardGrid min="regular">
        <StatCard
          title="Longest wait"
          subtitle={longest?.title ?? ''}
          info="Time since the oldest one last changed. Shorter is better."
          phase={phase}
          empty={nothing ? { cause: 'Nothing waits.' } : null}
          value={longest?.days ?? null}
          unit="days"
          status={{
            tone: late > 0 ? 'bad' : 'neutral',
            label: ready ? `${late} Issues late` : '',
          }}
          sub={longest?.id ?? ''}
          subMono
          axisLabels={['Oldest', 'Dashed line, one week', 'Newest']}
          chart={(box) => (
            <Sparkline
              height={box.height}
              label="Time waited by each Issue, oldest first"
              points={rows.map((r) => ({ value: r.days }))}
              reference={LATE_HOURS / 24}
              cap={CAP_DAYS}
            />
          )}
          footer={[
            { label: 'Now', value: longest ? STATE_WORD[longest.state] : '' },
            { label: 'Attempts', value: longest?.attempts ?? '' },
          ]}
        />
        <BarList
          title="Issues by state"
          subtitle={
            ready && !nothing
              ? `${rows.length} open, ${running === 0 ? 'nothing' : running} running`
              : ''
          }
          phase={phase}
          empty={nothing ? { cause: 'Nothing to count.' } : null}
          bodyRows={STATES.length}
          items={
            nothing
              ? []
              : STATES.map((s) => ({
                  key: s,
                  label: STATE_WORD[s],
                  value: rows.filter((r) => r.state === s).length,
                }))
          }
          focusItems={{ focus, holds: (row, r) => r.state === row.key }}
        />
      </CardGrid>
      <DataPanel
        title="Open Issues"
        subtitle="By wait, late after one week"
        phase={phase}
        empty={
          nothing
            ? { cause: 'Nothing is waiting in argo. A new Issue appears here when it is filed.' }
            : null
        }
        bodySize={{ rows: 14 }}
        body={() => <DataTable table={table} height="fill" focus={focus} />}
      />
      {focus.live}
    </Page>
  )
}
