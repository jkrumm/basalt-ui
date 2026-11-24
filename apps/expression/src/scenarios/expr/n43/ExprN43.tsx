/**
 * Expression n43. The factory owner reviews Specs and Reports: which came in this week per project,
 * and which still wait for a verdict (a document nobody answers gets "looks good" after 24 hours).
 * One focus joins the project list, the table of documents and both figures.
 */
import { useFormat } from 'basalt-ui'
import { BarList, DataPanel, StatCard } from 'basalt-ui/cards'
import type { Delta, FootFacts, Phase, Verdict } from 'basalt-ui/cards'
import { Sparkline, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import type { ScenarioProps } from '../../shot-state'
import { NOW, PROJECTS, WEEK, fixtureFor } from './fixture'
import { STATES, STATE_LABEL, modelOf } from './model'
import type { Doc, ProjectRow, Summary } from './model'

// cycle-expression-10: BarList paints a segment through Tailwind's `dark:` variant, which follows the
// OS and not the app's scheme, so a hex pair shows its light value under an explicit dark scheme;
// a BASALT token switches itself, so the series sit on the ink ramp as token pairs (ink, and ink at two alphas).
const ink = (token: string) => ({ light: token, dark: token })
const LEGEND = [
  { key: 'waiting', label: STATE_LABEL.waiting, color: ink(BASALT.brand) },
  { key: 'changes', label: STATE_LABEL.changes, color: ink(BASALT.ink) },
  { key: 'good', label: STATE_LABEL.good, color: ink(alpha(BASALT.ink, 0.55)) },
  { key: 'byDefault', label: STATE_LABEL.byDefault, color: ink(alpha(BASALT.ink, 0.25)) },
]

const ERROR: Phase = {
  tag: 'error',
  message: 'The artifact store did not answer.',
  retry: () => undefined,
}

const c = col<Doc>()
const COLUMNS = [
  c.entity('title', { header: 'Document', priority: 1 }),
  c.entity('project', { header: 'Project', priority: 2, mono: true }),
  c.text('kind', { header: 'Kind', priority: 2, labels: { spec: 'Spec', report: 'Report' } }),
  c.relativeTime('submittedAt', { header: 'Submitted', priority: 2 }),
  c.status('state', {
    header: 'Verdict',
    priority: 1,
    options: STATES,
    labels: STATE_LABEL,
    // cycle-expression-10: a status dot has a tone, not a series color, so the three decided states
    // share the neutral dot and the verdict word tells them apart (the bars draw them in three steps).
    tone: (state) => (state === 'waiting' ? 'accent' : 'neutral'),
  }),
  c.meter('waitHours', { header: 'Wait, default at 24 h', priority: 2, max: 24 }),
]

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `\u2212${Math.abs(n)}` : '0')

const secondary = (p: ProjectRow): string =>
  p.total === 0
    ? 'Nothing submitted'
    : p.counts.waiting > 0
      ? `${p.counts.waiting} waiting`
      : 'Nothing waits'

const EMPTY_CAUSE =
  'No Spec or Report came in this week. New ones appear here when an agent submits one.'

export function ExprN43Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const phase: Phase = shotState === 'loading' ? 'loading' : shotState === 'error' ? ERROR : 'ready'
  const ready = phase === 'ready'
  const model = modelOf(ready ? fixtureFor(shotState === 'empty' ? 'quiet' : fixture) : [])

  const focus = useChartFocus(model.projects, {
    announce: (p) =>
      `${p.name}: ${p.total} came in, ${p.counts.waiting} waiting, ${p.counts.changes} changes, ${p.counts.good} looks good, ${p.counts.byDefault} by default`,
  })

  const waiting = (s: Summary, sub: string, subMono: boolean) => {
    const delta: Delta = {
      value: signed(s.counts.waiting - s.waitingAgo),
      polarity: 'up-bad',
      label: 'vs a week ago',
    }
    const status: Verdict =
      s.nextDefaultAt === null
        ? { tone: 'neutral', label: 'Nothing waits' }
        : { tone: 'accent', label: `Default ${f.relative(s.nextDefaultAt, NOW)}` }
    const footer: FootFacts = [
      {
        label: 'Oldest waiting',
        value: s.oldestWaitingH === null ? '\u2014' : `${s.oldestWaitingH} h`,
      },
      { label: 'Decided by default', value: s.counts.byDefault },
    ]
    return { value: s.counts.waiting, delta, status, sub, subMono, footer }
  }
  const came = (s: Summary, sub: string, subMono: boolean) => {
    const delta: Delta = {
      value: signed(s.total - s.previous),
      polarity: 'neutral',
      label: 'vs last week',
    }
    const footer: FootFacts = [
      { label: 'Specs', value: s.specs },
      { label: 'Reports', value: s.reports },
    ]
    return { value: s.total, delta, sub, subMono, footer }
  }
  const everyone = `All ${PROJECTS.length} projects`
  const waitingShown = focus.readout(waiting(model.all, everyone, false), (p) =>
    waiting(p, p.name, true),
  )
  const cameShown = focus.readout(came(model.all, 'Specs and Reports', false), (p) =>
    came(p, p.name, true),
  )
  const perDay = focus.readout(model.all.perDay, (p) => p.perDay)

  const table = useDataTable({
    id: 'n43-documents',
    label: 'Specs and Reports this week',
    columns: COLUMNS,
    data: model.docs,
    getRowId: (d) => d.id,
    mode: { kind: 'client' },
    now: NOW,
  })

  return (
    <Page area="expr-n43">
      <PageBar title="Specs and Reports this week" />
      <div className="@container">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 @wide:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-4">
              <StatCard
                title="Waiting for a verdict"
                info="Specs and Reports with no verdict yet. One still waiting 24 hours after it came in is marked looks good by default."
                phase={phase}
                {...waitingShown}
              />
              <StatCard
                title="New documents"
                phase={phase}
                chart={(box) => (
                  <Sparkline
                    height={box.height}
                    points={perDay}
                    label="Specs and Reports that came in per day over 14 days"
                  />
                )}
                axisLabels={['14 days ago', '7 days ago', 'Today']}
                {...cameShown}
              />
            </div>
            <BarList
              title="Verdict by project"
              subtitle="most waiting first"
              phase={phase}
              bodyRows={7}
              series={LEGEND}
              focus={focus}
              items={model.projects.map((p) => ({
                key: p.name,
                label: p.name,
                value: p.total,
                secondary: secondary(p),
                parts: p.counts,
              }))}
            />
          </div>
          <DataPanel
            title="Verdict on each document"
            subtitle={`${f.date(NOW - WEEK, 'short')} to ${f.date(NOW, 'short')} UTC, waiting first`}
            phase={phase}
            empty={model.docs.length > 0 ? null : { cause: EMPTY_CAUSE }}
            // cycle-expression-10: the panel cannot take its height from the table, so the rows it holds are chosen by hand.
            bodySize={{ rows: 12 }}
            body={() => (
              <DataTable
                table={table}
                height="fill"
                focusItems={{ focus, holds: (d, p) => d.project === p.name }}
              />
            )}
          />
        </div>
      </div>
      {focus.live}
    </Page>
  )
}
