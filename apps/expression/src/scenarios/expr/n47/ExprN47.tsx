import { useFormat } from 'basalt-ui'
import { BarList, DataPanel, StatCard } from 'basalt-ui/cards'
import type { Delta, Empty, Phase } from 'basalt-ui/cards'
import { ChartCard, IntervalTrack, useChartFocus } from 'basalt-ui/charts'
import type { IntervalSeries } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { ISSUE_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { HOUR_MS, MINUTE_MS, issueNamed, span, timeRows } from './model'
import type { Kind, PartKind, Step } from './model'

type Row = Step & { when: string; minutes: number | null }

const KIND_NAMES: Record<Kind, string> = {
  work: 'Working',
  owner: 'Waiting on owner',
  ci: 'Waiting on CI',
  hold: 'Held for queue or merge window',
  blocked: 'Blocked',
  event: 'Event',
}

const TRACK_KINDS: readonly Kind[] = ['work', 'owner', 'ci', 'hold', 'blocked', 'event']
const TRACK_SERIES = TRACK_KINDS.map((key): IntervalSeries<Kind> => ({
  key,
  label: KIND_NAMES[key],
  color: ISSUE_SERIES[key],
  fill: key === 'hold' ? 'outline' : 'solid',
}))

const PART_KINDS: readonly PartKind[] = ['work', 'owner', 'ci', 'hold', 'blocked']
const PART_SERIES = PART_KINDS.map((key) => ({
  key,
  label: KIND_NAMES[key],
  color: ISSUE_SERIES[key],
}))

const PRIORITY: Record<Kind, number> = { blocked: 3, event: 3, work: 1, owner: 1, ci: 1, hold: 0 }
const LANES = ['Issue', 'Attempt 1', 'Attempt 2', 'Attempt 3']

const EMPTY_CAUSE =
  'No events are recorded for this Issue yet. They appear once the factory admits it.'

const noop = (): void => undefined

const c = col<Row>()

export function ExprN47Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const issue = issueNamed(fixture)
  const empty = shotState === 'empty'
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: `The factory did not return Issue ${issue.id}.` }
        : 'ready'
  const ready = phase === 'ready' && !empty
  const emptyState: Empty | null = empty ? { cause: EMPTY_CAUSE } : null

  const clock = (d: Date): string =>
    f.time(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const day = (d: Date): string => `${f.date(d, 'weekday')} ${clock(d)}`
  const minutesOf = (s: Step): number | null =>
    s.end === null ? null : Math.round((s.end.getTime() - s.start.getTime()) / MINUTE_MS)
  const rows: Row[] = empty
    ? []
    : issue.steps.map((s) => ({
        ...s,
        when: day(s.start),
        minutes: minutesOf(s),
      }))
  const longest = Math.max(1, ...rows.map((r) => r.minutes ?? 0))

  const describe = (r: Row): string => {
    const took = r.minutes === null ? '' : `, ${span(r.minutes * MINUTE_MS)}`
    const session =
      r.turns === null
        ? ''
        : `, ${r.turns} turns, ${r.ktokens ?? 0}K tokens, ${f.money(r.cost ?? 0, 'USD')}`
    return `${r.lane}, ${r.name}: ${r.when}${took}${session}`
  }
  const focus = useChartFocus(rows, { announce: describe })

  const totalMs = (issue.shippedAt ?? issue.endAt).getTime() - issue.filedAt.getTime()
  const gapMs = totalMs - issue.medianMs
  const restDelta: Delta = {
    value: `${gapMs < 0 ? '\u2212' : '+'}${span(Math.abs(gapMs))}`,
    polarity: 'up-bad',
    label: 'vs median',
  }
  const share = (r: Row): Delta => ({
    value:
      r.minutes === null
        ? '0%'
        : f.percent((r.minutes * MINUTE_MS) / totalMs, { maximumFractionDigits: 0 }),
    polarity: 'neutral',
    label: 'of the time',
  })

  const sessions = rows.filter((r) => r.turns !== null)
  const ktokens = sessions.reduce((sum, r) => sum + (r.ktokens ?? 0), 0)
  const cost = sessions.reduce((sum, r) => sum + (r.cost ?? 0), 0)
  const waits = rows.filter((r) => r.kind !== 'work' && r.kind !== 'event' && r.end !== null)
  const longestWait = waits.reduce<Row | null>(
    (best, r) => ((r.minutes ?? 0) > (best?.minutes ?? -1) ? r : best),
    null,
  )
  const dropped = (issue.shippedAt ?? issue.endAt).getTime()

  const table = useDataTable({
    id: 'expr-n47-steps',
    label: `Steps of Issue ${issue.id}`,
    columns: [
      c.entity('name', { header: 'Step', sub: (r) => r.detail, priority: 1 }),
      c.entity('when', { header: 'Starts, UTC', mono: true, sortable: false, priority: 2 }),
      c.text('lane', { header: 'Attempt', sortable: false, priority: 3 }),
      c.meter('minutes', { header: 'Took, min', max: longest, sortable: false, priority: 1 }),
      c.number('turns', { header: 'Turns', sortable: false, priority: 3 }),
      c.number('ktokens', { header: 'Tokens', unit: 'K', sortable: false, priority: 3 }),
      c.money('cost', { header: 'Cost', currency: 'USD', sortable: false, priority: 2 }),
    ],
    data: rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    empty: emptyState,
    bodyRows: 12,
  })

  const timeByGroup = empty ? [] : timeRows(issue)
  return (
    <Page area="expr-n47">
      <PageBar title={`Issue ${issue.id}: ${issue.title}`} />
      <div className="grid gap-3 @wide:grid-cols-5">
        <div className="@wide:col-span-3">
          <ChartCard
            title="Filed to shipped"
            subtitle="Attempts, waits and sessions, UTC"
            phase={phase}
            empty={emptyState}
            height="tall"
            figure={
              ready
                ? {
                    // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n47, kept as its builder left it: its figure follows focus, built before figure-readout
                    value: focus.readout(span(totalMs), (r) =>
                      r.minutes === null ? clock(r.start) : span(r.minutes * MINUTE_MS),
                    ),
                    // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n47, kept as its builder left it: its figure follows focus, built before figure-readout
                    delta: focus.readout<Delta>(restDelta, share),
                    period: focus.readout(
                      issue.shippedAt === null ? 'filed, not shipped' : 'filed to shipped',
                      (r) => `${r.lane}: ${r.name}`,
                    ),
                  }
                : { value: null }
            }
            footer={
              ready
                ? [
                    {
                      label: 'Tokens',
                      value: `${f.number(ktokens / 1000, { maximumFractionDigits: 2 })}M`,
                    },
                    { label: 'Cost', value: f.money(cost, 'USD') },
                  ]
                : undefined
            }
            chart={(box) => (
              <IntervalTrack
                height={box.height}
                label={`Steps of Issue ${issue.id} by attempt over time`}
                data={rows}
                rows={LANES.filter((lane) => rows.some((r) => r.lane === lane))}
                getRow={(r) => r.lane}
                getStart={(r) => r.start}
                getEnd={(r) => r.end}
                series={TRACK_SERIES}
                getSeries={(r) => r.kind}
                getLabel={(r) => (r.kind === 'blocked' ? `${r.name}: ${r.detail ?? ''}` : r.name)}
                getPriority={(r) => PRIORITY[r.kind]}
                xDomain={[
                  new Date(issue.filedAt.getTime() - HOUR_MS / 2),
                  new Date(dropped + HOUR_MS * 2),
                ]}
                formatX={day}
                legend={false}
                focus={focus}
                tooltip={false}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-3 @wide:col-span-2">
          <BarList
            title="Where the time went"
            subtitle="By attempt, working and waiting"
            phase={phase}
            empty={emptyState}
            bodyRows={4}
            focusItems={{ focus, holds: (row, item) => item.group === row.key }}
            series={PART_SERIES}
            format={(minutes) => span(minutes * MINUTE_MS)}
            items={timeByGroup.map((g) => ({
              key: g.key,
              label: g.label,
              secondary: g.outcome,
              value: g.minutes,
              parts: g.parts,
            }))}
          />
          <StatCard
            title="Longest wait"
            subtitle="Nothing was working during it"
            phase={phase}
            empty={emptyState}
            value={ready && longestWait ? span((longestWait.minutes ?? 0) * MINUTE_MS) : null}
            delta={ready && longestWait ? share(longestWait) : undefined}
            sub={
              ready && longestWait
                ? `${longestWait.name}${longestWait.detail === null ? '' : `: ${longestWait.detail}`}`
                : undefined
            }
            footer={
              ready && longestWait && longestWait.end !== null
                ? [
                    { label: 'From', value: longestWait.when, mono: true },
                    { label: 'Until', value: day(longestWait.end), mono: true },
                  ]
                : undefined
            }
          />
        </div>
      </div>
      <DataPanel
        title="Steps and sessions"
        subtitle="In time order; turns, tokens and cost belong to sessions"
        phase={phase}
        empty={emptyState}
        bodySize={{ rows: 8 }}
        body={() => <DataTable table={table} focus={focus} height="fill" />}
      />
    </Page>
  )
}
