/**
 * A table of windows beside an hourly chart (contract (a) of expression cycle 9): each window row holds the
 * run of hours it spans through `DataTable focusItems`, so pointing at a row or stepping onto it
 * holds the run, the chart draws it as one x band and the live region says the window.
 */
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { Page, PageBar, Section } from 'basalt-ui/page'
import { BAR_SERIES } from '../../demo/series'
import type { ScenarioProps } from '../shot-state'

type Hour = { h: number; tide: number }
type Window = { id: string; from: number; to: number; peak: number }

const NEED = 2.4
const HOURS: readonly Hour[] = Array.from({ length: 24 }, (_, h) => ({
  h,
  tide: Math.round((2.2 + Math.sin((h / 12.4) * 2 * Math.PI) * 0.9) * 10) / 10,
}))

/** Every run of hours with the tide at or over the need, in time order. */
function windowsOf(hours: readonly Hour[]): Window[] {
  const out: Window[] = []
  for (const d of hours) {
    if (d.tide < NEED) continue
    const last = out.at(-1)
    if (last !== undefined && last.to === d.h - 1) {
      last.to = d.h
      last.peak = Math.max(last.peak, d.tide)
    } else out.push({ id: `w-${d.h}`, from: d.h, to: d.h, peak: d.tide })
  }
  return out
}

const clock = (h: number): string => `${String(h).padStart(2, '0')}:00`
const label = (w: Window): string => `${clock(w.from)}–${clock(w.to + 1)}`

const c = col<Window & { label: string; hours: number }>()
const COLUMNS = [
  c.entity('label', { header: 'Window', mono: true, sortable: false }),
  c.number('hours', { header: 'Hours', unit: 'h', sortable: false }),
  c.number('peak', { header: 'Peak tide', unit: 'm', digits: 1, sortable: false }),
]

export function LinkedWindowsScenario({ shotState }: ScenarioProps) {
  const phase = shotState === 'loading' ? ('loading' as const) : 'ready'
  const windows = windowsOf(HOURS).map((w) => ({
    ...w,
    label: label(w),
    hours: w.to - w.from + 1,
  }))
  const focus = useChartFocus(HOURS, {
    announce: (d) => `${clock(d.h)}: tide ${d.tide} m`,
    announceSpan: (run) =>
      `Window ${clock(run[0]?.h ?? 0)} to ${clock((run.at(-1)?.h ?? 0) + 1)}: ${run.length} hours`,
  })
  const table = useDataTable({
    id: 'linked-windows',
    label: 'Windows over the bar',
    columns: COLUMNS,
    data: windows,
    getRowId: (w) => w.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: windows.length,
  })
  return (
    <Page area="linked-windows">
      <PageBar title="Water over the bar, next 24 hours" />
      <ChartCard
        title="Tide by hour"
        phase={phase}
        figure={{
          value: `${windows.length} windows`,
          period: focus.readout('', (d) =>
            focus.span.length > 1 ? `${focus.span.length} h held` : `${clock(d.h)}: ${d.tide} m`,
          ),
        }}
        chart={() => (
          <CartesianChart
            label="Water over the bar for each of the next 24 hours"
            data={HOURS}
            focus={focus}
            tooltip={false}
            x={{ value: (d) => d.h, format: (x) => clock(Number(x)) }}
            y={{ title: 'Metres', domain: { floor: 0, ceil: 4 } }}
            series={[
              {
                key: 'tide',
                label: 'Tide',
                color: BAR_SERIES.tide,
                mark: 'line',
                y: (d) => d.tide,
              },
            ]}
            refLines={[{ value: NEED, color: BAR_SERIES.need, dashed: true, label: 'Bar needs' }]}
          />
        )}
      />
      <Section title="Windows">
        <div data-shot="windows">
          <DataTable
            table={table}
            focusItems={{ focus, holds: (w, d) => d.h >= w.from && d.h <= w.to }}
          />
        </div>
      </Section>
    </Page>
  )
}
