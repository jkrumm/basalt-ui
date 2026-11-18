import { useFormat } from 'basalt-ui'
import { BarList, StatCell, StatGroup } from 'basalt-ui/cards'
import type { Empty, Phase } from 'basalt-ui/cards'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { useChartFocus } from 'basalt-ui/charts'
import { col, DataTable, TableToolbar, useDataTable } from 'basalt-ui/table'
import type { ReactElement } from 'react'

import type { ScenarioProps } from '../../shot-state'
import {
  FLAKY_BELOW,
  SLOW_MS,
  bySeverity,
  isDown,
  isFlaky,
  isSlow,
  minutesDown,
  monitorRows,
  toRows,
  usualMinutesDown,
} from './fixture'
import type { MonitorRow, ShownState, MonitorType } from './fixture'

const c = col<MonitorRow>()

const SHOWN_STATES = [
  'down',
  'pending',
  'slow',
  'flaky',
  'up',
  'maintenance',
  'paused',
] as const satisfies readonly ShownState[]

const STATE_LABELS: Record<ShownState, string> = {
  up: 'Up',
  down: 'Down',
  pending: 'Pending',
  slow: 'Slow',
  flaky: 'Flaky',
  maintenance: 'Maintenance',
  paused: 'Paused',
}

const STATE_TONES = {
  up: 'neutral',
  down: 'bad',
  pending: 'accent',
  slow: 'warn',
  flaky: 'warn',
  maintenance: 'info',
  paused: 'neutral',
} as const

const TYPE_LABELS: Record<MonitorType, string> = {
  http: 'HTTP',
  tcp: 'TCP port',
  ping: 'Ping',
  dns: 'DNS',
  container: 'Container',
  push: 'Push',
  group: 'Group',
}

const ROW_TIERS = [3, 4, 5, 6, 7, 8, 9, 10] as const

const EMPTY: Empty = {
  cause: 'No monitors are set up yet. Add one and its checks appear here.',
  // cycle-expression-7: the playground has no add-monitor flow, so the action is inert
  action: { label: 'Add monitor', onClick: () => undefined },
}

/** The shot state a frame draws: loading and error come from the URL, the rest is ready. */
function phaseOf(shotState: ScenarioProps['shotState']): Phase {
  if (shotState === 'loading') return 'loading'
  if (shotState === 'error') {
    return { tag: 'error', message: 'The monitor service did not answer.', retry: () => undefined }
  }
  return 'ready'
}

/** The first name, then how many more. */
function leadName(rows: readonly MonitorRow[], none: string): string {
  const [first, ...rest] = rows
  if (first === undefined) return none
  return rest.length > 0 ? `${first.name} and ${rest.length} more` : first.name
}

export function ExprN23Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const f = useFormat()
  const phase = phaseOf(shotState)
  const all = shotState === 'empty' ? [] : bySeverity(monitorRows(fixture))
  const rows = toRows(all)
  const ready = phase === 'ready' && rows.length > 0
  const empty = shotState === 'empty' ? EMPTY : null

  const leaves = rows
  const down = leaves.filter(isDown)
  const slow = leaves.filter(isSlow).toSorted((a, b) => (b.latency ?? 0) - (a.latency ?? 0))
  const flaky = leaves.filter(isFlaky).toSorted((a, b) => minutesDown(b) - minutesDown(a))
  const parked = rows.filter((row) => row.status === 'paused' || row.status === 'maintenance')
  const minutesNow = flaky.reduce((sum, row) => sum + minutesDown(row), 0)
  const minutesUsual = flaky.reduce((sum, row) => sum + usualMinutesDown(row), 0)
  const change = minutesNow - minutesUsual

  // The BarList rows and the table rows are the same monitors: one focus drives both.
  const focus = useChartFocus(flaky, {
    announce: (row) => `${row.name}: ${minutesDown(row)} min down in the last day`,
  })

  const table = useDataTable({
    id: 'monitors',
    label: 'Monitors',
    columns: [
      c.entity('name', { header: 'Monitor', sub: (row) => row.group, filter: 'text', priority: 1 }),
      c.status('shown', {
        header: 'Status',
        options: SHOWN_STATES,
        labels: STATE_LABELS,
        tone: (value) => STATE_TONES[value],
        filter: 'multi',
        priority: 1,
      }),
      c.number('latency', { header: 'Latency', unit: 'ms', priority: 2 }),
      c.number('up1d', { header: 'Uptime, 1 day', unit: '%', digits: 2, priority: 2 }),
      c.number('up30d', { header: 'Uptime, 30 days', unit: '%', digits: 2, priority: 2 }),
      c.text('type', { header: 'Type', labels: TYPE_LABELS, priority: 3 }),
    ],
    data: phase === 'ready' ? rows : undefined,
    phase,
    empty,
    getRowId: (row) => row.id,
    mode: { kind: 'client' },
  })

  const flakyItems = flaky.map((row) => ({
    label: row.name,
    value: minutesDown(row),
    secondary: row.status === 'down' ? 'Down now' : `usual ${usualMinutesDown(row)} min`,
  }))

  return (
    <Page area="expr-n23">
      <PageBar title="Homelab monitors" />
      <StatGroup variant="strip" label="Monitor health">
        <StatCell
          label="Down"
          value={ready ? down.length : null}
          unit={ready ? `of ${leaves.length}` : undefined}
          status={
            ready
              ? down.length > 0
                ? { tone: 'bad', label: 'Needs action' }
                : undefined
              : { tone: 'neutral', label: 'Unknown' }
          }
          sub={ready ? leadName(down, 'None') : ''}
          phase={phase}
        />
        <StatCell
          label="Slow"
          qualifier={`over ${SLOW_MS} ms`}
          value={ready ? slow.length : null}
          status={
            ready
              ? slow.length > 0
                ? { tone: 'warn', label: 'Degraded' }
                : undefined
              : { tone: 'neutral', label: 'Unknown' }
          }
          sub={ready ? leadName(slow, 'None') : ''}
          phase={phase}
        />
        <StatCell
          label="Flaky"
          qualifier={`under ${f.percent(FLAKY_BELOW / 100, { maximumFractionDigits: 1 })}, 1 day`}
          value={ready ? flaky.length : null}
          delta={
            ready && flaky.length > 0
              ? {
                  value: `${change < 0 ? '−' : '+'}${f.number(Math.abs(change), { notation: 'compact' })} min`,
                  polarity: 'up-bad',
                  label: 'vs usual day',
                }
              : undefined
          }
          sub={ready ? `${f.number(minutesNow)} min down in total` : ''}
          phase={phase}
        />
        <StatCell
          label="Paused or in maintenance"
          value={ready ? parked.length : null}
          sub={ready ? leadName(parked, 'Everything is running') : ''}
          phase={phase}
        />
      </StatGroup>
      <div className="grid min-w-0 items-start gap-4 @wide:grid-cols-[minmax(0,1fr)_auto]">
        <div className="flex flex-col gap-2 @wide:order-last @wide:w-88">
          <p className="m-0 text-sm text-muted-foreground">
            {focus.readout(
              ready ? `${flaky.length} flaky in the last day` : '',
              (row) =>
                `${row.name}: ${minutesDown(row)} min down, usual ${usualMinutesDown(row)} min`,
            )}
          </p>
          <BarList
            title="Flaky in the last day"
            subtitle="Minutes down"
            items={flakyItems}
            format={(value) => `${f.number(value)} min`}
            bodyRows={ROW_TIERS.find((n) => n >= flakyItems.length) ?? 10}
            focus={focus}
            phase={phase}
            empty={
              shotState === 'empty'
                ? { cause: 'Nothing to rank without monitors.' }
                : flakyItems.length === 0
                  ? { cause: 'No running monitor dropped a check in the last day.' }
                  : null
            }
          />
        </div>
        <Section title="All monitors">
          <TableToolbar table={table} />
          <DataTable table={table} focus={focus} />
        </Section>
      </div>
      {focus.live}
    </Page>
  )
}
