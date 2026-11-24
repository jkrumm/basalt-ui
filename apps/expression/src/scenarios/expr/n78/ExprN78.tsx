import { useFormat } from 'basalt-ui'
import { DataPanel, StatCell, StatGroup } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { Sparkline, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { AlertTriangle, ArrowLeftRight, Hourglass, Mail } from 'lucide-react'
import type { ScenarioProps } from '../../shot-state'
import { DAYS, NOW, parseFixture, rowsOf } from './fixture'
import type { Fixture, MailboxRow, SyncState } from './fixture'

const STATE_LABEL: Record<SyncState, string> = {
  syncing: 'Syncing',
  stalled: 'Stalled',
  never: 'Never synced',
}

const retryGateway = (): void => {}

const c = col<MailboxRow>()

const sum = (rows: readonly MailboxRow[], pick: (r: MailboxRow) => number): number =>
  rows.reduce((n, r) => n + pick(r), 0)

const ROWS = {
  rest: rowsOf('rest'),
  calm: rowsOf('calm'),
  backlog: rowsOf('backlog'),
} satisfies Record<Fixture, MailboxRow[]>
const NO_ROWS: MailboxRow[] = []

export function ExprN78Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const all = ROWS[parseFixture(fixture)]
  const rows = shotState === 'empty' ? NO_ROWS : all

  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'Timed out', retry: retryGateway }
        : 'ready'

  const focus = useChartFocus(rows, {
    announce: (r) =>
      `${r.address}: ${STATE_LABEL[r.state]}, ${r.pending} pending, ${r.failed} failed, ${r.in30} in, ${r.out30} out`,
  })

  const oldest = Math.max(1, ...all.map((r) => r.silentMinutes ?? 0))
  const busiest = Math.max(1, ...all.map((r) => r.pending))
  const failing = Math.max(1, ...all.map((r) => r.failed))
  const table = useDataTable({
    id: 'expr-n78-mailboxes',
    label: 'Status table',
    columns: [
      c.entity('address', {
        header: 'Address',
        mono: true,
        sub: (r) => r.provider,
        priority: 1,
        card: 'title',
      }),
      c.status('state', {
        header: 'State',
        options: ['never', 'stalled', 'syncing'],
        labels: STATE_LABEL,
        tone: (s) => (s === 'syncing' ? 'neutral' : 'bad'),
        priority: 1,
        card: 'badge',
      }),
      c.meter('silentMinutes', { header: 'Silence, min', max: oldest, priority: 2, card: 'meta' }),
      c.meter('pending', { header: 'Pending', max: busiest, priority: 2, card: 'meta' }),
      c.meter('failed', { header: 'Failed', max: failing, priority: 2, card: 'meta' }),
      c.number('in30', { header: 'In', priority: 2, card: 'meta' }),
      c.number('out30', { header: 'Out', priority: 2, card: 'meta' }),
      c.text('lastError', { header: 'Last error', priority: 3, card: 'meta' }),
    ],
    data: rows,
    phase,
    bodyRows: all.length,
    now: NOW,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })

  const away = rows.filter((r) => r.state !== 'syncing')
  const awayPending = sum(away, (r) => r.pending)
  const pending = sum(rows, (r) => r.pending)
  const failed = sum(rows, (r) => r.failed)
  const hit = rows.filter((r) => r.failed > 0)
  const messages = sum(rows, (r) => r.in30 + r.out30)
  const prior = sum(rows, (r) => r.prior)
  const change = prior === 0 ? (messages === 0 ? 0 : undefined) : (messages - prior) / prior
  const perDay = Array.from({ length: DAYS }, (_, i) => ({
    value: sum(rows, (r) => (r.daily[i]?.in ?? 0) + (r.daily[i]?.out ?? 0)),
    label: f.date(rows[0]?.daily[i]?.day ?? 0, 'day'),
  }))

  return (
    <Page area="expr-n78">
      <PageBar title="Mailboxes, last 30 days" />
      <StatGroup variant="cards" label="Summary">
        <StatCell
          icon={Mail}
          title="Mailboxes syncing"
          value={rows.length - away.length}
          unit={`of ${rows.length}`}
          status={
            away.length > 0
              ? { tone: 'bad', label: `${away.length} need a look` }
              : { tone: 'neutral', label: rows.length === 0 ? 'None connected' : 'All in sync' }
          }
          rows={[
            { label: STATE_LABEL.stalled, value: rows.filter((r) => r.state === 'stalled').length },
            { label: STATE_LABEL.never, value: rows.filter((r) => r.state === 'never').length },
          ]}
          phase={phase}
          empty={null}
        />
        <StatCell
          icon={ArrowLeftRight}
          title="Messages in and out"
          value={f.number(messages)}
          delta={
            change === undefined
              ? undefined
              : {
                  value: `${change < 0 ? '\u2212' : change > 0 ? '+' : ''}${f.percent(Math.abs(change))}`,
                  polarity: 'neutral',
                  label: 'vs prior 30 d',
                }
          }
          chart={(box) => (
            <Sparkline points={perDay} height={box.height} label="Trend, all addresses" />
          )}
          rows={[
            { label: 'In', value: f.number(sum(rows, (r) => r.in30)) },
            { label: 'Out', value: f.number(sum(rows, (r) => r.out30)) },
          ]}
          phase={phase}
          empty={null}
        />
        <StatCell
          icon={Hourglass}
          title="Backlog"
          unit="jobs"
          value={f.number(pending)}
          rows={[
            { label: 'Behind stalled', value: f.number(awayPending) },
            { label: 'Behind the rest', value: f.number(pending - awayPending) },
          ]}
          phase={phase}
          empty={null}
        />
        <StatCell
          icon={AlertTriangle}
          title="Failures"
          value={f.number(failed)}
          status={
            hit.length > 0
              ? { tone: 'bad', label: `${hit.length} with failures` }
              : { tone: 'neutral', label: 'None failed' }
          }
          rows={[
            { label: 'Most on one', value: f.number(Math.max(0, ...rows.map((r) => r.failed))) },
          ]}
          phase={phase}
          empty={null}
        />
      </StatGroup>
      <DataPanel
        title="Sync status"
        subtitle="Stalled after 1 h of silence"
        phase={phase}
        empty={
          rows.length === 0
            ? { cause: 'No mailbox is connected to this gateway. Add one in its settings.' }
            : null
        }
        bodySize={{ rows: all.length + 1 }}
        body={() => <DataTable table={table} focus={focus} />}
      />
      {focus.live}
    </Page>
  )
}
