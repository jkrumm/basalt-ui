import type { Empty, Phase } from 'basalt-ui/cards'
import type { ChartFigure } from 'basalt-ui/charts'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { alpha, BASALT } from 'basalt-ui/tokens'
import { SPRINT_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import {
  buckets,
  DAYS_LEFT,
  items,
  SPRINT,
  STATUS_LABEL,
  STATUSES,
  ticketsFor,
  type Item,
} from './fixture'

type Delta = NonNullable<ChartFigure['delta']>

const MINUS = '−'
const signed = (n: number) => (n < 0 ? `${MINUS}${-n}` : n > 0 ? `+${n}` : '0')

const c = col<Item>()
const COLUMNS = [
  c.entity('id', {
    header: 'Ticket',
    mono: true,
    priority: 1,
    sub: (r) => (r.addedDay === null ? r.title : `${r.title}, added day ${r.addedDay}`),
  }),
  c.text('reason', { header: 'At risk because', priority: 1 }),
  c.number('daysInStatus', { header: 'Days in status', priority: 3 }),
  c.number('points', { header: 'Points', priority: 3 }),
  c.status('status', {
    header: 'Status',
    options: STATUSES,
    labels: STATUS_LABEL,
    tone: () => 'neutral',
    priority: 3,
  }),
  c.text('assignee', { header: 'Assignee', priority: 3 }),
]

const NO_TICKETS: Empty = { cause: 'No tickets are in this sprint. Add some from the backlog.' }

const error = (): Phase => ({
  tag: 'error',
  message: 'The sprint board did not answer.',
  retry: () => undefined,
})

export function ExprN37Scenario({ shotState, fixture }: ScenarioProps) {
  const phase: Phase =
    shotState === 'loading' ? 'loading' : shotState === 'error' ? error() : 'ready'
  const all = shotState === undefined ? items(ticketsFor(fixture)) : []
  const ready = shotState === undefined
  const list = buckets(all)
  const total = all.reduce((sum, t) => sum + (t.points ?? 0), 0)
  const done = list.find((b) => b.status === 'done')?.points ?? 0
  const pace = Math.round((total * SPRINT.elapsedDays) / SPRINT.workDays)
  const risks = all.filter((t) => t.reason !== '')
  const added = all.filter((t) => t.addedDay !== null)
  const unestimated = all.find((t) => t.points === null)
  const hidden = shotState === 'loading' ? '' : '–'

  const focus = useChartFocus<Item>(all, {
    announce: (t) =>
      `${t.id} ${t.title}: ${STATUS_LABEL[t.status]}, ${t.points ?? 'no'} pts, ${t.daysInStatus} days in status${t.reason === '' ? '' : `, at risk: ${t.reason}`}`,
  })

  const table = useDataTable({
    id: 'sprint-at-risk',
    label: 'Tickets at risk',
    columns: COLUMNS,
    data: phase === 'ready' ? risks : undefined,
    phase,
    empty:
      shotState === 'empty'
        ? NO_TICKETS
        : { cause: 'No open ticket is at risk. Every one fits the days left.' },
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })

  return (
    <Page area="expr-n37">
      <PageBar title={`${SPRINT.name}, Nov 9 to 20`} />
      <div className="@container">
        <div className="grid gap-4 @wide:grid-cols-5">
          <div className="@wide:col-span-3">
            <ChartCard
              title="Tickets by status"
              height="auto"
              phase={phase}
              empty={shotState === 'empty' ? NO_TICKETS : null}
              figure={{
                // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n37, kept as its builder left it: its figure follows focus, built before figure-readout
                value: ready
                  ? focus.readout<string | number>(`${done} of ${total}`, (t) => t.points ?? '–')
                  : null,
                unit: 'pts',
                // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n37, kept as its builder left it: its figure follows focus, built before figure-readout
                delta: ready
                  ? focus.readout<Delta>(
                      { value: signed(done - pace), polarity: 'up-good', label: 'vs pace' },
                      (t) => ({
                        value: STATUS_LABEL[t.status],
                        polarity: 'neutral',
                        label: `${t.daysInStatus} days`,
                      }),
                    )
                  : undefined,
                period: ready
                  ? focus.readout(`${DAYS_LEFT} days left`, (t) => `${t.id}, ${t.title}`)
                  : undefined,
              }}
              footer={[
                {
                  label: 'Added after start',
                  value: ready
                    ? `${added.length} tickets, ${added.reduce((s, t) => s + (t.points ?? 0), 0)} pts`
                    : hidden,
                },
                {
                  label: 'No estimate',
                  value: ready ? (unestimated?.id ?? 'none') : hidden,
                  mono: true,
                },
              ]}
              chart={() => (
                <CartesianChart<Item>
                  label="Story points of each ticket, grouped by status"
                  data={all}
                  focus={focus}
                  tooltip={false}
                  x={{ value: (t) => t.id, ticks: [] }}
                  zones={list.map((b, i) => ({
                    axis: 'x' as const,
                    from: b.first,
                    to: b.last,
                    fill: alpha(BASALT.inkMuted, i % 2 === 0 ? 0.1 : 0.04),
                    label: `${b.label}, ${b.points} pts`,
                  }))}
                  series={[
                    {
                      mark: 'bar',
                      key: 'points',
                      label: 'Points',
                      color: SPRINT_SERIES.points,
                      y: (t) => t.points ?? 0,
                      values: (_v, t) => (t.reason === '' ? '' : t.id),
                      highlight: (t) => t.reason !== '',
                      opacity: (t) => (t.status === 'done' ? 1 : 0.55),
                    },
                  ]}
                />
              )}
            />
          </div>
          <div className="@wide:col-span-2">
            <Section
              title="Tickets at risk"
              summary={
                ready
                  ? `${risks.length} tickets, ${risks.reduce((s, r) => s + (r.points ?? 0), 0)} pts`
                  : ''
              }
            >
              <DataTable table={table} focus={focus} />
            </Section>
          </div>
        </div>
      </div>
      {focus.live}
    </Page>
  )
}
