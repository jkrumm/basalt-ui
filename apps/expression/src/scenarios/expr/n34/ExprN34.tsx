import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import type { ChartRefLine, ChartZone } from 'basalt-ui/charts'
import { createFormat } from 'basalt-ui'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { alpha, BASALT } from 'basalt-ui/tokens'
import type { Phase } from 'basalt-ui/cards'
import { BAR_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { harbour } from './fixture'
import type { Hour, Window } from './fixture'

const fmt = createFormat()
const clock = (d: Date) => fmt.time(d, { hour: '2-digit', minute: '2-digit', hour12: false })
const stamp = (d: Date) => `${fmt.date(d, 'weekday')} ${clock(d)}`
const metres = (v: number) =>
  `${fmt.number(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} m`
const HOUR_MS = 3_600_000

const windowText = (w: Window) =>
  w.hours === 1 ? stamp(w.from.at) : `${stamp(w.from.at)}–${clock(w.to.at)}`

function holdReason(d: Hour, need: number, limit: number): string {
  if (d.tide < need && d.swell > limit) return 'bar dry, swell too high'
  return d.tide < need ? 'bar too shallow' : 'swell too high'
}

const SERIES = [
  {
    mark: 'line',
    key: 'tide',
    label: 'Water over the bar',
    color: BAR_SERIES.tide,
    weight: 'strong',
    curve: 'monotone',
    y: (d: Hour) => d.tide,
    format: metres,
  },
  {
    mark: 'line',
    key: 'swell',
    label: 'Swell height',
    color: BAR_SERIES.swell,
    curve: 'monotone',
    y: (d: Hour) => d.swell,
    format: metres,
  },
] as const

type WindowRow = { id: string; label: string; hours: number; peak: number; swell: number }
const c = col<WindowRow>()
const WINDOW_COLUMNS = [
  c.entity('label', { header: 'Window, UTC', mono: true, sortable: false }),
  c.number('hours', { header: 'Hours', unit: 'h', sortable: false }),
  c.number('peak', { header: 'Peak tide', unit: 'm', digits: 1, sortable: false }),
  c.number('swell', { header: 'Highest swell', unit: 'm', digits: 1, sortable: false }),
]

export function ExprN34Scenario({ shotState, fixture }: ScenarioProps) {
  const { hours, windows, barNeed, swellLimit, highWaters, clearingHighWaters, calmHours } =
    harbour(fixture)
  const focus = useChartFocus(hours, {
    announce: (d) =>
      `${stamp(d.at)}: tide ${metres(d.tide)}, swell ${metres(d.swell)} at ${d.period} s, ${
        d.go ? 'go' : 'hold'
      }`,
  })

  const phase: Phase | undefined =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The tide station did not answer.', retry: () => undefined }
        : undefined
  const empty =
    shotState === 'empty'
      ? {
          cause:
            'No tide table is published for the next 48 hours. Check again after the next update.',
        }
      : null
  const ready = shotState === undefined
  const windowRows: WindowRow[] = windows.map((w) => {
    const span = hours.filter((d) => d.h >= w.from.h && d.h <= w.to.h)
    return {
      id: String(w.from.h),
      label: windowText(w),
      hours: w.hours,
      peak: Math.max(...span.map((d) => d.tide)),
      swell: Math.max(...span.map((d) => d.swell)),
    }
  })
  const windowTable = useDataTable({
    id: 'go-windows',
    label: 'Go windows',
    columns: WINDOW_COLUMNS,
    data: windowRows,
    phase: phase ?? 'ready',
    empty:
      empty ??
      (windows.length === 0
        ? { cause: `The swell stays above ${metres(swellLimit)} whenever the bar is clear.` }
        : null),
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
  })

  const first = windows[0]
  const rest = first === undefined ? 'No window in 48 h' : `Go ${windowText(first)}`
  const zones: ChartZone[] = windows.map((w) => ({
    axis: 'x',
    from: new Date(w.from.at.getTime() - HOUR_MS / 2),
    to: new Date(w.to.at.getTime() + HOUR_MS / 2),
    fill: alpha(BASALT.brand, 0.14),
  }))
  const refLines: ChartRefLine[] = [
    { value: barNeed, color: BAR_SERIES.need, dashed: true, label: `Bar needs ${metres(barNeed)}` },
    {
      value: swellLimit,
      color: BAR_SERIES.limit,
      dashed: true,
      label: `Crew limit ${metres(swellLimit)}`,
    },
  ]

  return (
    <Page area="expr-n34">
      <PageBar title="Leaving the harbour, next 48 hours" />
      <ChartCard
        title="Water over the bar and swell"
        subtitle="Hourly from Fri 00:00 UTC"
        phase={phase}
        empty={empty}
        figure={
          ready
            ? {
                // oxlint-disable-next-line basalt/primitive-bypass -- trial evidence of expression cycle n34, kept as its builder left it: its figure follows focus, built before figure-readout
                value: focus.readout(rest, (d) =>
                  d.go ? `Go ${stamp(d.at)}` : `Hold ${stamp(d.at)}`,
                ),
                period: focus.readout(
                  first === undefined
                    ? undefined
                    : `${windows.length} ${windows.length === 1 ? 'window' : 'windows'}, ${windows.reduce((n, w) => n + w.hours, 0)} h`,
                  (d) => `tide ${metres(d.tide)}, swell ${metres(d.swell)}, ${d.period} s`,
                ),
                periodMono: true,
                status: focus.readout(undefined, (d) =>
                  d.go
                    ? { tone: 'accent' as const, label: 'Go' }
                    : { tone: 'neutral' as const, label: holdReason(d, barNeed, swellLimit) },
                ),
              }
            : { value: null }
        }
        footer={[
          {
            label: 'High waters clear',
            value: ready ? `${clearingHighWaters} of ${highWaters}` : '—',
          },
          {
            label: 'Calm hours',
            value: ready ? `${calmHours} of ${hours.length}` : '—',
          },
        ]}
        chart={() => (
          <CartesianChart
            label="Water over the bar and swell height for each of the next 48 hours"
            data={hours}
            focus={focus}
            tooltip={false}
            summary={
              windows.length === 0
                ? `No hour clears the bar with the swell under ${metres(swellLimit)}.`
                : `Go windows: ${windows.map(windowText).join('; ')}.`
            }
            x={{
              value: (d) => d.at,
              format: (x) => {
                const at = new Date(x)
                return at.getUTCHours() === 0 ? fmt.date(at, 'weekday') : clock(at)
              },
              ticks: 8,
            }}
            y={{ title: 'Metres', domain: { floor: 0, ceil: 4 }, format: (v) => fmt.number(v) }}
            series={[...SERIES]}
            zones={zones}
            refLines={refLines}
          />
        )}
      />
      <Section title="Go windows">
        <DataTable table={windowTable} />
      </Section>
    </Page>
  )
}
