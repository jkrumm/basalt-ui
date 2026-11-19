import { useFormat } from 'basalt-ui'
import { DataPanel } from 'basalt-ui/cards'
import type { Empty, Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import { CardGrid, Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { RIDE_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import {
  MIN_WINDOW_HOURS,
  RAIN_LIMIT,
  WIND_LIMIT,
  forecastFor,
  isRideHour,
  windowEnd,
} from './fixture'
import type { Hour, RideWindow } from './fixture'

type WindowRow = RideWindow & { label: string }

const NO_FORECAST: Empty = {
  cause: 'No forecast for the next 48 hours yet. Reload after the next hourly update.',
}
const NO_WINDOW: Empty = {
  cause: `No run of ${MIN_WINDOW_HOURS} h or longer stays under both limits. Check the next forecast.`,
}

function verdictOf(h: Hour): string {
  if (isRideHour(h)) return 'Ride'
  if (h.rain > RAIN_LIMIT && h.wind > WIND_LIMIT) return 'Too wet and windy'
  return h.rain > RAIN_LIMIT ? 'Too wet' : 'Too windy'
}

export function ExprN04Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const forecast = forecastFor(fixture)
  const { hours, windows } = forecast

  const clock = (d: Date) => f.time(d, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const day = (d: Date) => f.date(d, 'weekday', { weekday: 'short' })
  const hourLabel = (d: Date) => `${day(d)} ${clock(d)}`
  const windowLabel = (w: RideWindow) => {
    const end = windowEnd(w)
    const endsLater = day(end) !== day(w.from) && clock(end) !== '00:00'
    return `${hourLabel(w.from)}–${endsLater ? hourLabel(end) : clock(end)}`
  }
  const hourFacts = (h: Hour) =>
    `${f.number(h.rain)} % rain, ${f.number(h.wind)} km/h wind, ${f.number(h.temp)} °C`

  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: 'The forecast service did not answer.', retry: () => undefined }
        : 'ready'
  const noForecast = shotState === 'empty'

  const best = windows.reduce<RideWindow | null>(
    (top, w) => (top === null || w.hours > top.hours ? w : top),
    null,
  )
  const peak = hours.reduce<Hour | null>(
    (top, h) => (top === null || h.wind > top.wind ? h : top),
    null,
  )
  const rideHours = hours.filter(isRideHour).length

  const focus = useChartFocus(hours, {
    announce: (h) => `${hourLabel(h.at)}: ${hourFacts(h)}, ${verdictOf(h)}`,
    announceSpan: (run) =>
      `Ride window ${hourLabel(run[0]!.at)} to ${clock(new Date(run.at(-1)!.at.getTime() + 3_600_000))}: ${run.length} h`,
  })

  const c = col<WindowRow>()
  const columns = [
    c.entity('label', { header: 'Window', mono: true, sortable: false, priority: 1 }),
    c.meter('hours', { header: 'Hours', sortable: false, priority: 1, max: best?.hours ?? 1 }),
    c.number('rainMax', { header: 'Rain, %', sortable: false, priority: 2 }),
    c.number('windMax', { header: 'Wind, km/h', sortable: false, priority: 2 }),
    c.number('tempAvg', { header: 'Temp, °C', sortable: false, priority: 2 }),
  ]
  const rows: WindowRow[] = windows.map((w) => ({ ...w, label: windowLabel(w) }))
  const table = useDataTable({
    id: 'n04-windows',
    label: 'Ride windows',
    columns,
    data: rows,
    getRowId: (w) => w.id,
    mode: { kind: 'client' },
    phase,
    bodyRows: 5,
    phone: 'scroll',
    empty: noForecast ? NO_FORECAST : windows.length === 0 ? NO_WINDOW : null,
  })

  const restStatus = best
    ? { tone: 'accent' as const, label: 'Dry and calm' }
    : { tone: 'neutral' as const, label: 'Stay in' }

  return (
    <Page area="n04">
      <PageBar title="Ride windows, next 48 hours" />
      <CardGrid min="regular">
        <ChartCard
          title="Rain and wind by hour"
          subtitle="Hourly, from Friday 06:00"
          phase={phase}
          empty={noForecast ? NO_FORECAST : null}
          height="tall"
          figure={{
            value: focus.readout(best ? windowLabel(best) : 'No window', (h) => hourLabel(h.at)),
            period: focus.readout(
              best ? `${best.hours} h, the longest window` : 'Every hour is over a limit',
              hourFacts,
            ),
            status: focus.readout(restStatus, (h) => ({
              tone: isRideHour(h) ? ('accent' as const) : ('neutral' as const),
              label: verdictOf(h),
            })),
          }}
          footer={[
            { label: 'Ride hours', value: `${rideHours} of ${hours.length}` },
            peak
              ? {
                  label: 'Peak wind',
                  value: `${f.number(peak.wind)} km/h`,
                }
              : null,
          ]}
          chart={() => (
            <CartesianChart
              label="Rain chance and wind speed for each of the next 48 hours, with the ride windows shaded"
              data={hours}
              focus={focus}
              tooltip={false}
              x={{
                value: (h) => h.at,
                format: (x) => (x instanceof Date ? hourLabel(x) : String(x)),
                ticks: hours.filter((_, i) => i % 6 === 0).map((h) => h.at),
              }}
              y={{ title: 'Rain chance, %', domain: [0, 100] }}
              series={[
                {
                  mark: 'bar',
                  key: 'rain',
                  label: 'Rain chance, %',
                  color: RIDE_SERIES.rain,
                  y: (h) => h.rain,
                  format: (v) => `${f.number(v)} %`,
                },
                {
                  mark: 'line',
                  key: 'wind',
                  label: 'Wind, km/h (right axis)',
                  color: RIDE_SERIES.wind,
                  axis: 'right',
                  y: (h) => h.wind,
                  format: (v) => `${f.number(v)} km/h`,
                },
              ]}
              zones={windows.map((w) => ({
                axis: 'x' as const,
                from: w.from,
                to: w.to,
                fill: alpha(BASALT.brand, 0.12),
                label: w === best && windows.length > 1 ? `Best ${w.hours} h` : `${w.hours} h`,
              }))}
              refLines={[
                {
                  value: RAIN_LIMIT,
                  color: RIDE_SERIES.rain,
                  dashed: true,
                  label: `Rain ${RAIN_LIMIT} %`,
                },
                {
                  value: WIND_LIMIT,
                  axis: 'right',
                  color: RIDE_SERIES.wind,
                  dashed: true,
                  label: `Wind ${WIND_LIMIT} km/h`,
                },
              ]}
            />
          )}
        />
        <DataPanel
          title="Ride windows"
          subtitle={`Runs of ${MIN_WINDOW_HOURS} h or longer under both limits; rain and wind peak, temperature mean`}
          phase={phase}
          empty={noForecast ? NO_FORECAST : windows.length === 0 ? NO_WINDOW : null}
          bodySize={{ rows: 5 }}
          body={() => (
            <DataTable
              table={table}
              focusItems={{ focus, holds: (w, h) => h.at >= w.from && h.at <= w.to }}
            />
          )}
        />
      </CardGrid>
    </Page>
  )
}
