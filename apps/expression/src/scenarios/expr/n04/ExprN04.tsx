import type { LegendEntry, Phase } from 'basalt-ui/cards'
import { DataPanel } from 'basalt-ui/cards'
import { ChartCard, useChartFocus } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT } from 'basalt-ui/tokens'
import type { ReactElement } from 'react'
import type { ScenarioProps } from '../../shot-state'
import { HOURS_SHOWN, hoursFor, stretchesOf } from './fixture'
import type { Cause, Hour, Stretch } from './fixture'
import { useHourFormat } from './clock'
import {
  RAIN_MAX,
  RAIN_NAME,
  RAIN_UNIT,
  RidePanels,
  WIND_MAX,
  WIND_NAME,
  WIND_UNIT,
} from './RidePanels'

type Row = Stretch & { range: string; temps: string }

const CAUSES: readonly Cause[] = ['ride', 'rain', 'wind', 'both']
const VERDICT: Record<Cause, string> = {
  ride: 'Ride',
  rain: 'Rain',
  wind: 'Wind',
  both: 'Both',
}
const NO_FORECAST = 'No forecast yet. It arrives with the next model run, so check back in an hour.'
const NO_RESPONSE = 'The forecast service did not respond.'
const WINDOW_KEY: LegendEntry = {
  key: 'window',
  label: 'Window',
  color: { light: BASALT.brand, dark: BASALT.brand },
  swatch: 'bar',
}
const noop = (): void => undefined
const c = col<Row>()

export function ExprN04Scenario({ shotState, fixture }: ScenarioProps): ReactElement {
  const { clock, day } = useHourFormat()
  const range = (s: Stretch): string => {
    const sameDay = day(s.start) === day(s.end)
    return `${day(s.start)} ${clock(s.start)}–${sameDay ? '' : `${day(s.end)} `}${clock(s.end)}`
  }
  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', retry: noop, message: NO_RESPONSE }
        : 'ready'
  const ready = phase === 'ready' && shotState !== 'empty'
  const hours: readonly Hour[] = shotState === 'empty' ? [] : hoursFor(fixture)
  const stretches = stretchesOf(hours)
  const windows = stretches.filter((s) => s.cause === 'ride')
  const rows: Row[] = stretches.map((s) => ({
    ...s,
    range: range(s),
    temps: s.minTemp === s.maxTemp ? `${s.minTemp} °C` : `${s.minTemp} to ${s.maxTemp} °C`,
  }))
  const next = windows[0]
  const longest = windows.reduce<Stretch | undefined>(
    (best, w) => (best === undefined || w.hours > best.hours ? w : best),
    undefined,
  )
  const rideHours = windows.reduce((sum, w) => sum + w.hours, 0)
  const reading = (d: Hour): string =>
    `${day(d.at)} ${clock(d.at)}: rain ${d.rain} ${RAIN_UNIT}, wind ${d.wind} ${WIND_UNIT}, ${d.temp} °C`
  const focus = useChartFocus(hours, { announce: reading })
  const table = useDataTable({
    id: 'ride-stretches',
    label: 'Stretches',
    columns: [
      c.entity('range', { header: 'Stretch', mono: true, priority: 1, sortable: false }),
      c.status('cause', {
        header: 'Verdict',
        options: CAUSES,
        labels: VERDICT,
        tone: (v) => (v === 'ride' ? 'accent' : 'neutral'),
        priority: 1,
        sortable: false,
      }),
      c.meter('hours', { header: 'Hours', max: HOURS_SHOWN, priority: 2, sortable: false }),
      c.number('peakRain', {
        header: `${RAIN_NAME} peak`,
        unit: RAIN_UNIT,
        priority: 3,
        sortable: false,
      }),
      c.number('peakWind', {
        header: `${WIND_NAME} peak`,
        unit: WIND_UNIT,
        priority: 3,
        sortable: false,
      }),
      c.text('temps', { header: 'Temperature', priority: 3, sortable: false }),
    ],
    data: rows,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: rows.length,
  })
  const windowCount = `${windows.length} ${windows.length === 1 ? 'window' : 'windows'}`
  return (
    <Page area="n04">
      <PageBar title="Ride windows, next 48 hours" />
      <div className="grid gap-3 @wide:grid-cols-2">
        <ChartCard
          title="Hourly forecast"
          subtitle={`${RAIN_NAME} up to ${RAIN_MAX} ${RAIN_UNIT}, ${WIND_NAME} up to ${WIND_MAX} ${WIND_UNIT}`}
          phase={phase}
          empty={shotState === 'empty' ? { cause: NO_FORECAST } : null}
          height="tall"
          legend={[WINDOW_KEY]}
          figure={
            ready
              ? {
                  value: next === undefined ? 'No window' : `Ride ${range(next)}`,
                  period: focus.readout(
                    next === undefined ? 'Every hour is over a limit' : windowCount,
                    reading,
                  ),
                }
              : { value: null }
          }
          footer={[
            { label: 'Dry and calm', value: ready ? `${rideHours} of ${HOURS_SHOWN} h` : '' },
            { label: 'Longest', value: ready ? `${longest?.hours ?? 0} h` : '' },
          ]}
          chart={() => <RidePanels hours={hours} windows={windows} focus={focus} />}
        />
        <DataPanel
          title="Stretches by verdict"
          subtitle="One row per run of hours with the same verdict"
          phase={phase}
          empty={shotState === 'empty' ? { cause: NO_FORECAST } : null}
          bodySize={{ rows: Math.max(rows.length, 11) + 1 }}
          body={() => (
            <DataTable
              table={table}
              height="fill"
              focusItems={{
                focus,
                holds: (row: Row, item: Hour) => item.h >= row.from && item.h <= row.to,
              }}
            />
          )}
        />
      </div>
      {focus.live}
    </Page>
  )
}
