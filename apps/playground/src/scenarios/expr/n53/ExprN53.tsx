import { ChainView, DataPanel, StatCell, StatGroup } from 'basalt-ui/cards'
import type { Phase, Verdict } from 'basalt-ui/cards'
import { useChartFocus } from 'basalt-ui/charts'
import { useFormat } from 'basalt-ui'
import { Page, PageBar } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import type { ScenarioProps } from '../../shot-state'
import { derive, planFor, summarize } from './fixture'
import type { PlanView, Shown } from './fixture'

const noop = () => {}
const DASH = '\u2014'
const NO_ROWS = { cause: 'Nothing is planned yet. Add the first row to docs/plan.yaml.' }
const HELD = '\u00a0'
const BODY = 900
/** Table order: the row that needs a hand first, then what can start, what waits, what is done. */
const ORDER: readonly Shown[] = ['blocked', 'next', 'open', 'waiting', 'done']

const SHOWN = ['next', 'open', 'blocked', 'waiting', 'done'] as const satisfies readonly Shown[]
const LABELS: Readonly<Record<Shown, string>> = {
  next: 'Start next',
  open: 'Open',
  blocked: 'Blocked',
  waiting: 'Waiting',
  done: 'Done',
}
// accent: the row that can start next; bad: the blocked row; every other state stays neutral.
const TONE: Readonly<Record<Shown, Verdict['tone']>> = {
  next: 'accent',
  open: 'neutral',
  blocked: 'bad',
  waiting: 'neutral',
  done: 'neutral',
}

const c = col<PlanView>()

const signed = (n: number): string => (n > 0 ? `+${n}` : n < 0 ? `\u2212${-n}` : '0')

export function ExprN53Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const rows = shotState === 'empty' ? [] : derive(planFor(fixture))
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: 'The plan service did not respond.' }
        : 'ready'
  const s = summarize(rows)
  const hasRows = rows.length > 0
  const ready = phase === 'ready' && hasRows
  const worst = s.blocked[0]
  const notDone = s.total - s.done
  const oldest = Math.max(1, ...rows.map((r) => r.days ?? 0))

  const ordered = rows.toSorted((a, b) => ORDER.indexOf(a.shown) - ORDER.indexOf(b.shown))
  const focus = useChartFocus(rows, {
    announce: (r) => `${r.title}: ${LABELS[r.shown]}, ${r.behind} waiting behind it`,
  })
  const table = useDataTable({
    id: 'expr-n53-rows',
    label: 'All rows',
    columns: [
      c.entity('title', { header: 'Row', sub: (r) => r.sub, subMono: true, priority: 1 }),
      c.status('shown', {
        header: 'State',
        options: SHOWN,
        labels: LABELS,
        tone: (v) => TONE[v],
        filter: 'multi',
        priority: 1,
      }),
      c.number('behind', { header: 'Holds back', priority: 3 }),
      c.meter('days', { header: 'Days open', max: oldest, priority: 3 }),
      c.date('filed', { header: 'Filed', priority: 3 }),
      c.date('closed', { header: 'Closed', priority: 3 }),
    ],
    data: ordered,
    getRowId: (r) => r.key,
    mode: { kind: 'client' },
    phase,
    empty: hasRows ? null : NO_ROWS,
    bodyRows: 12,
  })

  return (
    <Page area="expr-n53">
      <PageBar title="Ledger rewrite plan" />
      <StatGroup variant="cards" label="Progress, blockers and next row">
        <StatCell
          label="Plan progress"
          phase={phase}
          value={hasRows ? s.done : null}
          unit={`of ${s.total}`}
          meter={{
            label: 'Done',
            value: hasRows ? s.done : null,
            max: Math.max(1, s.total),
            format: (v) => f.percent(v / Math.max(1, s.total), { maximumFractionDigits: 0 }),
          }}
          rows={[
            {
              label: 'Closed in 7 days',
              value: s.closedWeek,
              ...(hasRows && {
                delta: {
                  value: signed(s.closedWeek - s.closedBefore),
                  polarity:
                    s.closedWeek > s.closedBefore ? ('up-good' as const) : ('neutral' as const),
                  label: 'vs last week',
                },
              }),
            },
            {
              label: 'Last closed',
              value: s.lastClosed === null ? DASH : f.date(s.lastClosed, 'short'),
            },
          ]}
        />
        <StatCell
          label="Blocked"
          phase={phase}
          value={hasRows ? s.blocked.length : null}
          status={worst ? { tone: 'bad', label: worst.title } : undefined}
          rows={[
            {
              label: 'Holds back',
              value: worst?.behind ?? 0,
              ...(worst && { bar: { value: worst.behind, max: Math.max(1, notDone) } }),
            },
            { label: 'Open for', value: worst?.days == null ? DASH : `${worst.days} d` },
          ]}
        />
        <StatCell
          label="Can start"
          phase={phase}
          value={hasRows ? s.ready.length : null}
          sub={
            hasRows && !s.next && worst ? `Every open row waits behind ${worst.title}` : undefined
          }
          status={s.next ? { tone: 'accent', label: s.next.title } : undefined}
          rows={[
            {
              label: 'Holds back',
              value: s.next?.behind ?? 0,
              ...(s.next && { bar: { value: s.next.behind, max: Math.max(1, notDone) } }),
            },
            {
              label: 'Filed',
              value: s.next?.filed == null ? DASH : f.date(s.next.filed, 'short'),
            },
          ]}
        />
      </StatGroup>
      <div className="grid gap-3 @wide:grid-cols-5">
        <div className="@wide:col-span-3">
          <DataPanel
            title="What waits on what"
            // cycle-expression-12: a frame draws no subtitle line until one is set, so the loading frame sits 16 px short; a no-break space holds the line
            subtitle={ready ? `Longest chain left: ${s.chainLeft} steps` : HELD}
            phase={phase}
            empty={hasRows ? null : { cause: 'A row appears here once it waits on another.' }}
            bodySize={{ height: BODY }}
            body={() => (
              <ChainView
                label="Unfinished work and its blockers"
                // cycle-expression-12: ChainView draws every node, so the 17 done rows would fill the graph; it gets the rows left and the table lists the rest
                nodes={rows.filter((r) => r.state !== 'done')}
                getId={(r) => r.key}
                waitsOn={(r) => r.waitsOn}
                face={(r) => ({
                  title: r.title,
                  sub: r.sub,
                  status: { tone: TONE[r.shown], label: LABELS[r.shown] },
                  done: false,
                })}
                focus={focus}
              />
            )}
          />
        </div>
        <div className="@wide:col-span-2">
          <DataPanel
            title="All rows"
            subtitle={
              ready
                ? s.noIssue > 0
                  ? `${s.noIssue} have no Issue yet`
                  : 'Every row has an Issue'
                : HELD
            }
            phase={phase}
            empty={hasRows ? null : NO_ROWS}
            bodySize={{ height: BODY }}
            body={() => <DataTable table={table} focus={focus} height="fill" />}
          />
        </div>
      </div>
    </Page>
  )
}
