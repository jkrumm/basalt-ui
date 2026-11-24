import { BarList, DataPanel } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { ChartCard, IntervalTrack, useChartFocus } from 'basalt-ui/charts'
import type { IntervalSeries } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { VirtualList } from 'basalt-ui/ui/virtual-list'
import { WEEK_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { weekFor } from './fixture'
import { analyse, clock, hm } from './model'
import type { Span, SpanKey } from './model'

const SERIES: readonly IntervalSeries<SpanKey>[] = [
  { key: 'meeting', label: 'Meeting', color: WEEK_SERIES.meeting },
  { key: 'focus', label: 'Focus', color: WEEK_SERIES.focus },
  { key: 'personal', label: 'Personal', color: WEEK_SERIES.personal },
  { key: 'declined', label: 'Declined', color: WEEK_SERIES.open, fill: 'outline' },
  {
    key: 'longest',
    label: 'Longest free block',
    color: WEEK_SERIES.longest,
    fill: 'outline',
    layer: 'back',
  },
]

const X_DOMAIN = [8 * 60, 19 * 60] as const
const X_TICKS = [8 * 60, 10 * 60, 12 * 60, 14 * 60, 16 * 60, 18 * 60]

const ERROR = 'The calendar did not answer.'
const EMPTY = 'No events on the calendar for 23 to 27 November. They appear here once you add some.'

const c = col<Span>()
const COLUMNS = [
  c.entity('name', { header: 'Event', priority: 1, sortable: false }),
  c.entity('when', { header: 'When', priority: 1, sortable: false, mono: true }),
  c.text('kindLabel', { header: 'Kind', priority: 3, sortable: false }),
  c.text('length', { header: 'Length', priority: 3, sortable: false }),
]

const announce = (s: Span): string => `${s.name}, ${s.when}, ${s.length}, ${s.kindLabel}`

export function ExprN35Scenario({ shotState, fixture }: ScenarioProps) {
  const full = weekFor(fixture)
  const week = shotState === 'empty' ? { ...full, events: [] } : full
  const a = analyse(week)
  const labels = new Map(a.days.map((d) => [d.key, d.label]))
  const hours = new Map(week.days.map((d) => [d.key, [d.open, d.close] as const]))
  const focus = useChartFocus(a.spans, { announce })

  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: ERROR }
        : 'ready'
  const ready = phase === 'ready'
  const empty = ready && a.events.length === 0 ? { cause: EMPTY } : null
  const retry = (): void => undefined

  const table = useDataTable({
    id: 'week-events',
    label: 'Calendar events',
    columns: COLUMNS,
    data: a.events,
    getRowId: (s) => s.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: 10,
  })

  return (
    <Page area="expr-n35">
      <PageBar title="Workweek, 23 to 27 November" />
      <div className="grid gap-4 @wide:grid-cols-2">
        <div className="flex flex-col gap-4">
          <ChartCard
            title="Events by workday"
            subtitle="Working hours shaded"
            height="tall"
            phase={typeof phase === 'object' ? { ...phase, retry } : phase}
            empty={empty}
            figure={{
              // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n35, kept as its builder left it: its figure follows focus, built before figure-readout
              value: ready ? focus.readout(a.longest?.length ?? '0 min', (s) => s.length) : null,
              period: ready
                ? focus.readout(
                    a.longest === null ? 'no free block' : `free ${a.longest.when}`,
                    (s) => `${s.name}, ${s.when}`,
                  )
                : undefined,
              periodMono: true,
            }}
            footer={[{ label: 'Booked', value: `${hm(a.booked)} of ${hm(a.work)}` }]}
            chart={(box) => (
              <IntervalTrack
                label="Calendar events for each workday of the coming week"
                height={box.height}
                data={a.spans}
                focus={focus}
                tooltip={false}
                rows={a.days.map((d) => d.key)}
                getRow={(s) => s.day}
                formatRow={(row) => labels.get(row) ?? row}
                getStart={(s) => s.start}
                getEnd={(s) => s.end}
                series={SERIES}
                getSeries={(s) => s.key}
                getLabel={(s) => (s.declined ? null : s.title)}
                getPriority={(s) => (s.key === 'longest' ? 1_000_000 : s.end - s.start)}
                rowExtent={(row) => hours.get(row) ?? null}
                xDomain={X_DOMAIN}
                xTicks={X_TICKS}
                formatX={(x) => clock(Number(x))}
              />
            )}
          />
          <BarList
            title="Booked by day"
            subtitle="Accepted events inside working hours"
            phase={phase}
            focusItems={{ focus, holds: (row, s) => s.day === row.key }}
            items={a.days.map((d) => ({
              key: d.key,
              label: d.label,
              value: d.booked,
              secondary: `of ${hm(d.work)}`,
            }))}
            max={Math.max(...a.days.map((d) => d.work))}
            format={hm}
          />
        </div>
        <DataPanel
          title="Events"
          subtitle="In week order, declined events included"
          phase={phase}
          bodySize={{ rows: 19 }}
          body={() => <DataTable table={table} focus={focus} height="fill" virtual={VirtualList} />}
        />
      </div>
    </Page>
  )
}
