import { useFormat } from 'basalt-ui'
import { DataPanel, StatCell, StatGroup } from 'basalt-ui/cards'
import type { Delta, Empty, FootFacts, Phase } from 'basalt-ui/cards'
import { ChartCard, Lines, useChartFocus } from 'basalt-ui/charts'
import type { ChartRefLine } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { ROUTER_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { LIMIT, NOW, routerFixture } from './fixture'
import type { Sample } from './fixture'
import { sampleAt, summarise } from './model'

const HOUR_MS = 3_600_000
const EVENT_ROWS = 4

type EventRow = {
  id: string
  at: Date
  time: string
  label: string
  memory: number | null
  cpu: number | null
}

const c = col<EventRow>()
const COLUMNS = [
  c.entity('time', {
    header: 'Event',
    mono: true,
    sub: (r) => r.label,
    sortable: false,
    priority: 1,
  }),
  c.number('memory', { header: 'Memory', unit: '%', sortable: false, priority: 2 }),
  c.number('cpu', { header: 'CPU', unit: '%', sortable: false, priority: 2 }),
]

const retry = (): void => undefined // fixture: no query behind the page to refetch

const EMPTY_READINGS: Empty = {
  cause: 'The router sent no readings in the last 24 hours. Check that it is on, then reload.',
}
const EMPTY_EVENTS: Empty = {
  cause: 'The line held for 24 hours. Drops and resyncs appear here when they happen.',
}
const EMPTY_LIST: Empty = { cause: 'No line events to list until the router sends readings.' }

function phaseOf(shotState: ScenarioProps['shotState']): Phase {
  if (shotState === 'loading') return 'loading'
  if (shotState === 'error') {
    return { tag: 'error', message: 'The router did not answer.', retry }
  }
  return 'ready'
}

// cycle-expression-10: `format.duration` reads a clock span (`915:00:00`), not days and hours
const uptimeText = (minutes: number): string =>
  `${Math.floor(minutes / 1440)} d ${Math.floor((minutes % 1440) / 60)} h`

export function ExprN42Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const phase = phaseOf(shotState)
  const router = shotState === undefined ? routerFixture(fixture) : null
  const summary = router === null ? null : summarise(router)
  const samples: readonly Sample[] = router?.samples ?? []
  const events = router?.events ?? []
  const noReadings = shotState === 'empty'

  const clock = (d: Date): string =>
    f.time(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const signed = (n: number): string => f.number(n, { signDisplay: 'exceptZero' })

  const focus = useChartFocus(samples, {
    announce: (d) => `${clock(d.at)}: memory ${d.mem} %, CPU ${d.cpu} %`,
  })

  const rows: EventRow[] = events
    .map((e) => {
      const reading = sampleAt(samples, e)
      return {
        id: e.id,
        at: e.at,
        time: clock(e.at),
        label: e.kind === 'drop' ? 'Line drop' : 'Resync',
        memory: reading?.mem ?? null,
        cpu: reading?.cpu ?? null,
      }
    })
    .reverse()
  const table = useDataTable({
    id: 'router-line-events',
    label: 'Line events in the last 24 hours',
    columns: COLUMNS,
    data: rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: EVENT_ROWS,
    // cycle-expression-10: a table in a DataPanel body draws phone cards that the fixed body clips, so the rows stay a table
    phone: 'scroll',
    empty: noReadings ? EMPTY_LIST : EMPTY_EVENTS,
  })

  const last = summary?.last ?? null
  const mover =
    last === null
      ? null
      : Math.abs(last.memory) >= Math.abs(last.cpu)
        ? { name: 'memory', points: last.memory }
        : { name: 'CPU', points: last.cpu }
  const restDelta: Delta | undefined =
    mover === null || last === null
      ? undefined
      : last.rose.length > 0
        ? { value: `${signed(mover.points)} pts`, polarity: 'up-bad' }
        : { value: `${signed(mover.points)} pts`, polarity: 'neutral', label: mover.name }
  const restPeriod =
    last === null
      ? 'in the last 24 hours'
      : last.rose.length > 0
        ? `${last.rose.join(' and ')} rose in the hour before the last drop`
        : 'Neither load rose in the hour before the last drop'
  const restValue =
    summary === null ? null : last === null ? 0 : last.rose.length > 0 ? 'Yes' : 'No'
  const footer: FootFacts = [
    { label: 'Median memory', value: summary === null ? '' : `${summary.medianMemory} %` },
    { label: 'Median CPU', value: summary === null ? '' : `${summary.medianCpu} %` },
  ]

  return (
    <Page area="expr-n42">
      <PageBar title="Router health, last 24 hours" />
      <StatGroup variant="strip" label="Router status">
        <StatCell
          label="Router status"
          info="Healthy while CPU and memory both stay under the limit drawn on the chart."
          value={summary === null ? null : summary.over.length === 0 ? 'Healthy' : 'Overloaded'}
          status={
            summary === null || summary.over.length === 0
              ? undefined
              : { tone: 'bad', label: `${summary.over.join(' and ')} over the limit` }
          }
          sub={
            noReadings
              ? 'Not measured, no readings'
              : router === null
                ? ''
                : `firmware ${router.firmware}`
          }
          subMono={!noReadings}
          phase={phase}
        />
        <StatCell label="CPU" value={summary?.now.cpu ?? null} unit="%" phase={phase} />
        <StatCell label="Memory" value={summary?.now.mem ?? null} unit="%" phase={phase} />
        <StatCell
          label="Uptime"
          value={router === null ? null : uptimeText(router.uptimeMinutes)}
          sub={
            router === null
              ? ''
              : `since ${f.date(new Date(NOW - router.uptimeMinutes * 60_000), 'short')}`
          }
          subMono
          phase={phase}
        />
      </StatGroup>
      <CardGrid min="wide">
        <ChartCard
          title="Router readings"
          subtitle="CPU and memory, one reading a minute, UTC"
          phase={phase}
          empty={noReadings ? EMPTY_READINGS : null}
          figure={{
            // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n42, kept as its builder left it: its figure follows focus, built before figure-readout
            value: focus.readout<string | number | null>(restValue, (d) => `${d.mem} %`),
            unit: focus.readout<string | undefined>(
              last === null ? 'drops' : undefined,
              () => 'memory',
            ),
            // cycle-expression-10: a focused minute has no delta, and readout needs its type spelled to return an absent one
            // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n42, kept as its builder left it: its figure follows focus, built before figure-readout
            delta: focus.readout<Delta | undefined>(restDelta, () => undefined),
            period: focus.readout(restPeriod, (d) => `${clock(d.at)}, CPU ${d.cpu} %`),
            periodMono: focus.readout(false, () => true),
          }}
          footer={footer}
          // cycle-expression-10: the chart slot only runs in ready, but the data-primitive lint refuses an empty-array fallback, so the slot guards the data itself
          chart={(box) =>
            router === null ? null : (
              <Lines
                height={box.height}
                label="Memory and CPU for each minute of the last 24 hours"
                data={router.samples}
                focus={focus}
                tooltip={false}
                x={{ value: (d) => d.at }}
                // cycle-expression-10: an end label collides with a line pinned to the plot's top edge, so the domain gets headroom above 100
                y={{ title: 'Used, %', domain: { floor: 0, ceil: 100, pad: 0.06 } }}
                series={[
                  {
                    mark: 'line',
                    key: 'memory',
                    label: 'Memory',
                    color: ROUTER_SERIES.memory,
                    weight: 'strong',
                    y: (d) => d.mem,
                  },
                  {
                    mark: 'line',
                    key: 'cpu',
                    label: 'CPU',
                    color: ROUTER_SERIES.cpu,
                    y: (d) => d.cpu,
                  },
                ]}
                zones={
                  last === null
                    ? []
                    : [
                        {
                          axis: 'x',
                          from: new Date(last.at.getTime() - HOUR_MS),
                          to: last.at,
                          fill: alpha(BASALT.brand, 0.1),
                          label: 'Hour before the drop',
                        },
                      ]
                }
                refLines={[
                  {
                    value: LIMIT,
                    color: ROUTER_SERIES.limit,
                    dashed: true,
                    label: `${LIMIT} % limit`,
                  },
                  ...events
                    .filter((e) => e.kind === 'drop')
                    .map((e): ChartRefLine => ({
                      axis: 'x',
                      value: e.at,
                      color: ROUTER_SERIES.event,
                      dashed: true,
                      label: 'Drop',
                    })),
                ]}
              />
            )
          }
        />
        <DataPanel
          title="Line events"
          subtitle="Drops and resyncs, newest first, UTC"
          phase={phase}
          empty={
            noReadings ? EMPTY_LIST : router !== null && events.length === 0 ? EMPTY_EVENTS : null
          }
          // cycle-expression-10: bodySize rows are desktop rows; the 390 px rows are taller, so two spare rows keep every event inside the fixed body
          bodySize={{ rows: EVENT_ROWS + 2 }}
          body={() => (
            <DataTable
              table={table}
              focusItems={{ focus, holds: (row, item) => item.at.getTime() === row.at.getTime() }}
            />
          )}
        />
      </CardGrid>
    </Page>
  )
}
