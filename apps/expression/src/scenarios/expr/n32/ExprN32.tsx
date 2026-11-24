/**
 * The factory owner checks the plan: which open Issues wait on others, and which one would
 * unblock the most if it shipped. One focus joins the figure, the dependency chain and the table.
 */
import { ChainView, DataPanel, StatCard } from 'basalt-ui/cards'
import type { Delta, Empty, Phase } from 'basalt-ui/cards'
import { useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { planOf } from './fixture'
import type { Issue, IssueState } from './fixture'
import type { ScenarioProps } from '../../shot-state'

const STATE_LABEL: Record<IssueState, string> = {
  building: 'Building',
  queued: 'Queued',
  waiting: 'Waiting',
}

const NONE_OPEN: Empty = { cause: 'No open Issues. New ones appear when an agent files one.' }
const NO_EDGES: Empty = { cause: 'Every open Issue can start.' }
const NO_ISSUES: Empty = { cause: 'Nothing to chain yet.' }

const c = col<Issue>()

const reload = (): void => undefined

/** One Retry for the page: the chain panel carries the cause and the button, the other frames the bare error. */
function phaseOf(shotState: ScenarioProps['shotState'], carries: boolean): Phase {
  if (shotState === 'loading') return 'loading'
  if (shotState !== 'error') return 'ready'
  if (!carries) return { tag: 'error' }
  return { tag: 'error', message: 'The factory did not answer the plan request.', retry: reload }
}

const plural = (n: number): string => (n === 1 ? 'Issue' : 'Issues')

export function ExprN32Scenario({ shotState, fixture }: ScenarioProps) {
  const phase = phaseOf(shotState, false)
  const chainPhase = phaseOf(shotState, true)
  const ready = phase === 'ready'
  const issues = ready && shotState !== 'empty' ? planOf(fixture) : []

  const top = issues[0]
  const runnerUp = issues[1]
  const waiting = issues.filter((i) => i.state === 'waiting').length
  const maxReach = top?.unblocks ?? 0
  const linked = issues.filter((i) => i.waitsOn.length > 0 || i.unblocks > 0)

  const focus = useChartFocus(issues, {
    announce: (i) =>
      `${i.title}: ${STATE_LABEL[i.state].toLowerCase()}, waits on ${i.waitsOn.length}, unblocks ${i.unblocks}`,
  })

  const table = useDataTable({
    id: 'plan-waits',
    label: 'Open Issues',
    columns: [
      c.entity('title', {
        header: 'Issue',
        priority: 1,
        sub: (i) => '#' + i.id,
        subMono: true,
      }),
      c.meter('unblocks', {
        header: 'Unblocks',
        priority: 1,
        card: 'value',
        max: Math.max(maxReach, 1),
      }),
      c.status('state', {
        header: 'State',
        priority: 2,
        options: ['building', 'queued', 'waiting'],
        labels: STATE_LABEL,
        tone: () => 'neutral',
      }),
      // owner-review-1: an entity column takes only a string, so "no blocker" is a dash I print myself
      c.entity('blockers', {
        header: 'Waits on',
        priority: 3,
        card: 'meta',
        sortable: false,
        width: 'content',
      }),
      c.text('project', { header: 'Project', priority: 3 }),
    ],
    data: issues,
    phase,
    getRowId: (i) => i.id,
    mode: { kind: 'client' },
    bodyRows: 12,
  })

  const restDelta: Delta | undefined =
    top !== undefined && runnerUp !== undefined && top.unblocks > 0
      ? {
          value: '+' + (top.unblocks - runnerUp.unblocks),
          label: 'vs runner-up',
          polarity: 'neutral',
        }
      : undefined

  const focusedDelta = (i: Issue): Delta | undefined => {
    if (i.id === top?.id) return restDelta
    return {
      value: '\u2212' + ((top?.unblocks ?? 0) - i.unblocks),
      label: 'vs the top blocker',
      polarity: 'neutral',
    }
  }

  return (
    <Page area="plan-waits">
      <PageBar title="Plan: what waits on what" />
      <div className="grid gap-3 @wide:grid-cols-2">
        <div className="@wide:col-start-2 @wide:row-start-1">
          <StatCard
            title="Unblocked if it ships"
            subtitle="open Issues waiting on it"
            info="Issues that wait on it, directly or through others. More means a bigger blocker."
            phase={phase}
            value={ready && top !== undefined ? focus.readout(top.unblocks, (i) => i.unblocks) : 0}
            unit={focus.readout(plural(top?.unblocks ?? 0), (i) => plural(i.unblocks))}
            delta={focus.readout(restDelta, focusedDelta)}
            sub={focus.readout(
              top !== undefined && top.unblocks > 0 ? top.title : 'Nothing blocks another Issue',
              (i) => i.title,
            )}
            footer={[{ label: 'Waiting', value: `${waiting} of ${issues.length}` }]}
          />
        </div>
        <div className="@wide:col-start-1 @wide:row-span-2 @wide:row-start-1">
          <DataPanel
            title="Dependency chain"
            subtitle="each Issue waits on the ones to its left"
            phase={chainPhase}
            empty={
              ready && linked.length === 0 ? (issues.length === 0 ? NO_ISSUES : NO_EDGES) : null
            }
            bodySize={{ height: 988 }}
            body={() => (
              // owner-review-1: ChainView has no vertical scroll of its own, so a chain taller than its panel clips
              <div className="flex h-full min-h-0 flex-col">
                <ScrollArea aria-label="Dependency chain">
                  <ChainView
                    label="Open Issues and what each waits on"
                    nodes={linked}
                    getId={(i) => i.id}
                    waitsOn={(i) => i.waitsOn}
                    face={(i) => ({
                      title: i.title,
                      sub: i.project,
                      status: {
                        tone: i.id === top?.id && i.unblocks > 0 ? 'accent' : 'neutral',
                        label:
                          i.id === top?.id && i.unblocks > 0
                            ? STATE_LABEL[i.state] + ', top blocker'
                            : STATE_LABEL[i.state],
                      },
                    })}
                    focus={focus}
                  />
                </ScrollArea>
              </div>
            )}
          />
        </div>
        <div className="@wide:col-start-2 @wide:row-start-2">
          <DataPanel
            title="Open Issues"
            subtitle="most unblocked first"
            phase={phase}
            empty={shotState === 'empty' ? NONE_OPEN : null}
            bodySize={{ height: 800 }}
            body={() => <DataTable table={table} focus={focus} height="fill" />}
          />
        </div>
      </div>
      {focus.live}
    </Page>
  )
}
