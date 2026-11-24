import { useFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT } from 'basalt-ui/tokens'
import { N70_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import {
  EVENTS,
  LIMIT,
  backPctOf,
  eventsFor,
  netOf,
  statusOf,
  type EventStatus,
  type HouseholdEvent,
} from './fixture'

type Row = HouseholdEvent & {
  net: number
  backPct: number
  status: EventStatus
  days: string
}

const OVER = { light: BASALT.brand, dark: BASALT.brand }

const STATUS_LABEL: Record<EventStatus, string> = {
  over: 'Over limit',
  waiting: 'Waiting',
  partial: 'Partial',
  settled: 'Settled',
}

const c = col<Row>()
const COLUMNS = [
  c.entity('name', { header: 'Event', sub: (r) => r.days, subMono: true, priority: 1 }),
  c.money('net', { header: 'Net', currency: 'EUR', priority: 1 }),
  c.status('status', {
    header: 'Status',
    options: ['over', 'waiting', 'partial', 'settled'],
    labels: STATUS_LABEL,
    tone: (s) => (s === 'over' ? 'accent' : 'neutral'),
    priority: 2,
  }),
  c.money('reimbursed', { header: 'Reimbursed', currency: 'EUR', priority: 2 }),
  c.money('paid', { header: 'Paid', currency: 'EUR', priority: 3 }),
  c.number('bookings', { header: 'Bookings', priority: 3 }),
]

export function ExprN70Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  // cycle-expression-15: useFormat().money prints a negative with an ASCII hyphen, and no money option writes the true minus
  const euro = (n: number): string =>
    `${n < 0 ? '\u2212' : ''}${f.money(Math.abs(n), 'EUR', { maximumFractionDigits: 0 })}`
  const signed = (n: number): string => (n > 0 ? `+${euro(n)}` : euro(n))
  const span = (e: HouseholdEvent): string =>
    e.from === e.to
      ? f.date(new Date(e.from), 'day')
      : `${f.date(new Date(e.from), 'day')}\u2013${f.date(new Date(e.to), 'day')}`

  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The ledger service did not answer.', retry: () => undefined }
        : 'ready'
  const ready = phase === 'ready'
  const events = shotState === 'empty' ? [] : eventsFor(fixture)
  const rows: readonly Row[] = events.map((e) => ({
    ...e,
    net: netOf(e),
    backPct: backPctOf(e),
    status: statusOf(e),
    days: span(e),
  }))

  const readNet = (d: Row): string => `${d.name}: net ${euro(d.net)}`
  const focus = useChartFocus(rows, {
    announce: (d) => `${readNet(d)}, paid ${euro(d.paid)}, reimbursed ${euro(d.reimbursed)}`,
  })
  const table = useDataTable({
    id: 'expr-n70',
    label: 'Ledger rows',
    columns: COLUMNS,
    data: rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: EVENTS.length,
  })

  const over = rows.filter((r) => r.status === 'over')
  const waiting = rows.filter((r) => r.status === 'waiting')
  const top = rows.reduce<Row | undefined>(
    (a, r) => (a === undefined || r.net > a.net ? r : a),
    undefined,
  )
  const restStatus = { tone: 'neutral' as const, label: ready ? `${waiting.length} waiting` : '' }
  const figure = {
    value: ready ? `${over.length} of ${rows.length}` : '',
    unit: 'events over',
    delta: {
      value: ready && top !== undefined ? signed(top.net - LIMIT) : '',
      polarity: 'neutral' as const,
      label: ready && top !== undefined ? `${top.name} vs limit` : '',
    },
    period: focus.readout('all events', readNet),
    status: focus.readout(restStatus, (d) => ({
      tone: 'neutral' as const,
      label: STATUS_LABEL[d.status],
    })),
  }
  const footer = [
    { label: 'Net, total', value: ready ? euro(rows.reduce((s, r) => s + r.net, 0)) : '' },
    {
      label: STATUS_LABEL.waiting,
      value: ready ? euro(waiting.reduce((s, r) => s + r.net, 0)) : '',
    },
  ] as const

  return (
    <Page area="expr-n70">
      <PageBar title="Trips and shared costs, 2026" />
      <CardGrid min="regular">
        <ChartCard
          title="Net cost per event"
          subtitle="2026, in date order"
          phase={phase}
          empty={
            rows.length > 0
              ? null
              : { cause: 'Nothing closed out yet. Close out one to see what it cost.' }
          }
          figure={figure}
          footer={footer}
          legend={[
            { key: 'net', label: 'Net', color: N70_SERIES.net, swatch: 'bar' },
            { key: 'over', label: STATUS_LABEL.over, color: OVER, swatch: 'bar' },
            { key: 'back', label: 'Share of paid', color: N70_SERIES.back, swatch: 'bar' },
          ]}
          height="tall"
          panes={[
            {
              weight: 3,
              chart: (box) => (
                <CartesianChart
                  label="Net per entry"
                  height={box.height}
                  data={rows}
                  focus={focus}
                  tooltip={false}
                  x={{ value: (d) => d.name }}
                  y={{ title: 'Net, EUR', domain: [-100, 600] }}
                  series={[
                    {
                      mark: 'bar',
                      key: 'net',
                      label: 'Net',
                      color: N70_SERIES.net,
                      y: (d) => d.net,
                      format: euro,
                      values: true,
                      highlight: (d) => d.net > LIMIT,
                      legend: false,
                    },
                  ]}
                  refLines={[
                    {
                      value: LIMIT,
                      color: N70_SERIES.limit,
                      dashed: true,
                      label: `Limit ${euro(LIMIT)}`,
                    },
                  ]}
                />
              ),
            },
            {
              weight: 2,
              chart: (box) => (
                <CartesianChart
                  label="Percent per entry"
                  height={box.height}
                  data={rows}
                  focus={focus}
                  tooltip={false}
                  x={{ value: (d) => d.name }}
                  y={{ title: 'Share, %', domain: [0, 120] }}
                  series={[
                    {
                      mark: 'bar',
                      key: 'back',
                      label: 'Percent',
                      color: N70_SERIES.back,
                      y: (d) => d.backPct,
                      format: (v) => `${Math.round(v)} %`,
                      values: true,
                      legend: false,
                    },
                  ]}
                />
              ),
            },
          ]}
        />
        <DataPanel
          title="Household ledger"
          subtitle="Waiting means nothing reimbursed yet"
          phase={phase}
          empty={
            rows.length > 0
              ? null
              : { cause: 'No rows yet. Rows arrive when a trip or shared cost closes out.' }
          }
          bodySize={{ rows: EVENTS.length + 1 }}
          body={() => <DataTable table={table} focus={focus} height="fill" />}
        />
      </CardGrid>
    </Page>
  )
}
