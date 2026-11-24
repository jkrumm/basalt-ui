/**
 * Night frost (case n39): will any of the next five nights freeze, for how long, and do the three
 * forecast models agree. One hourly chart of the three models and the dew point with the nights
 * shaded and each frost run drawn under the 0 °C rule; a table of the nights joined to it through
 * `DataTable focusItems`, so pointing at a night holds its hours.
 */
import { useFormat } from 'basalt-ui'
import type { Empty, Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import type { ChartZone, Series } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { DataTable, col, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { Card, CardBand, Inset } from 'basalt-ui/ui/card'
import { FROST_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { HELD, hourReadout, nightReadout, restReadout } from './figure'
import { MODELS, MODEL_NAME, forecastFor, type ModelKey } from './fixture'
import { buildForecast, type Hour, type Night } from './frost'
import { degrees, moment } from './text'

const FORECAST_DOWN = 'The forecast service did not answer.'
const EMPTY_CHART: Empty = {
  cause: 'No forecast hours came back for this place. Check again after the next model run.',
}
const EMPTY_NIGHTS: Empty = { cause: 'There are no nights to list until the forecast arrives.' }
const retry = () => undefined

type NightRow = Night & { agree: string } & Record<ModelKey, number>
const c = col<NightRow>()

/** The warm outlier takes the accent; the other two models take the ink steps in model order. */
function colourOf(model: ModelKey, outlier: ModelKey) {
  if (model === outlier) return FROST_SERIES.warm
  return MODELS.filter((m) => m !== outlier)[0] === model ? FROST_SERIES.first : FROST_SERIES.second
}

export function ExprN39Scenario({ shotState, fixture }: ScenarioProps) {
  const f = useFormat()
  const forecast = buildForecast(shotState === 'empty' ? [] : forecastFor(fixture), f)
  const { hours, nights, outlier } = forecast
  const ready = shotState === undefined
  const hasData = hours.length > 0

  const focus = useChartFocus(hours, {
    announce: (h) =>
      `${moment(f, h.at)}: ${MODELS.map((m) => `${MODEL_NAME[m]} ${degrees(f, h.temp[m])} °C`).join(', ')}, dew point ${degrees(f, h.dewMedian)} °C`,
    announceSpan: (run) => {
      const night = nights.find((n) => n.name === run[0]?.part)
      if (night === undefined) return `${run.length} hours`
      return `${night.name}: ${night.frostHours} h below 0 °C, lowest ${degrees(f, night.lowest)} °C, ${night.models} of 3 models freeze`
    },
    group: (h) => h.part,
  })

  const rows: NightRow[] = nights.map((n) => ({ ...n, ...n.hoursBy, agree: `${n.models} of 3` }))
  const longest = Math.max(1, ...nights.map((n) => n.frostHours))
  const tablePhase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: FORECAST_DOWN }
        : 'ready'
  const table = useDataTable({
    id: 'n39-nights',
    label: 'Frost by night',
    columns: [
      c.entity('name', { header: 'Night', priority: 1, sortable: false, width: 'content' }),
      c.number('lowest', { header: 'Lowest', unit: '°C', digits: 1, priority: 2, sortable: false }),
      c.meter('frostHours', {
        header: 'Below 0 °C, hours',
        max: longest,
        priority: 1,
        sortable: false,
      }),
      c.status('agree', {
        header: 'Models below 0 °C',
        options: ['0 of 3', '1 of 3', '2 of 3', '3 of 3'],
        tone: (v) => (v === '2 of 3' || v === '3 of 3' ? 'warn' : 'neutral'),
        priority: 2,
        sortable: false,
      }),
      ...MODELS.map((m) =>
        c.number(m, { header: MODEL_NAME[m], unit: 'h', priority: 3, sortable: false }),
      ),
    ],
    data: rows,
    getRowId: (n) => n.id,
    mode: { kind: 'client' },
    phase: tablePhase,
    empty: shotState === 'empty' ? EMPTY_NIGHTS : null,
    bodyRows: 5,
  })

  const chartPhase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: FORECAST_DOWN, retry }
        : 'ready'

  const rest = ready && hasData ? restReadout(forecast, f) : HELD
  // cycle-expression-10: `focus.readout` reads only the first item of a held span, so a held night (a table row) is read through `focus.span` by hand.
  const held =
    focus.span.length > 1 ? nights.find((n) => n.name === focus.span[0]?.part) : undefined
  const shown =
    held === undefined
      ? focus.readout(rest, (h) => hourReadout(h, forecast, f))
      : nightReadout(held, forecast, f)

  const floor =
    Math.floor(
      Math.min(0, ...hours.flatMap((h) => [...MODELS.map((m) => h.temp[m]), h.dewMedian])),
    ) - 1
  const ceil = Math.ceil(Math.max(0, ...hours.flatMap((h) => MODELS.map((m) => h.temp[m])))) + 1
  const series: Series<Hour>[] = [
    ...MODELS.map((m): Series<Hour> => ({
      mark: 'line',
      key: m,
      label: MODEL_NAME[m],
      color: colourOf(m, outlier.model),
      y: (h) => h.temp[m],
    })),
    {
      mark: 'line',
      key: 'dew',
      label: 'Dew point, median',
      color: FROST_SERIES.dew,
      dash: true,
      weight: 'quiet',
      y: (h) => h.dewMedian,
    },
  ]
  const zones: ChartZone[] = [
    ...nights.map((n): ChartZone => ({
      axis: 'x',
      from: n.from,
      to: n.to,
      fill: alpha(BASALT.ink, 0.05),
    })),
    ...nights.flatMap((n) =>
      n.runs.map((r): ChartZone => ({
        axis: 'x',
        from: r.from,
        to: r.to,
        y: { from: floor, to: 0 },
        fill: alpha(BASALT.warn, 0.22),
        label: `${r.hours} h`,
      })),
    ),
  ]
  // cycle-expression-10: a time axis labels ticks with a formatter of the tick's date, so the night names are looked up by each night's middle instant.
  const middle = (n: Night): number => (n.from.getTime() + n.to.getTime()) / 2
  const nightAt = new Map(nights.map((n) => [middle(n), n.name]))

  return (
    <Page area="expr-n39">
      <PageBar title="Night frost, next five nights" />
      <ChartCard
        title="Air temperature by model"
        subtitle="Hourly, nights shaded"
        phase={chartPhase}
        empty={shotState === 'empty' ? EMPTY_CHART : null}
        figure={shown.figure}
        footer={shown.footer}
        chart={() => (
          <CartesianChart
            label="Hourly air temperature from three forecast models over the next five nights, with the dew point"
            data={hours}
            focus={focus}
            tooltip={false}
            table
            x={{
              value: (h) => h.at,
              ticks: nights.map((n) => new Date(middle(n))),
              format: (x) => nightAt.get(new Date(x).getTime()) ?? '',
            }}
            y={{ title: '°C', domain: [floor, ceil], format: (v) => degrees(f, v) }}
            series={series}
            zones={zones}
            refLines={[{ value: 0, color: FROST_SERIES.limit, dashed: true, label: 'Frost, 0 °C' }]}
          />
        )}
      />
      {/* cycle-expression-10: DataPanel's body is a fixed box that clips a phone's night cards and drops the header row in empty and error, so the frame is built from Card, CardBand and Inset around a bare DataTable. */}
      <Card flush>
        <CardBand title="Frost by night" subtitle="Median of the three models, 18:00 to 08:00" />
        <Inset>
          <DataTable
            table={table}
            focusItems={{
              focus,
              holds: (n, h) =>
                h.at.getTime() >= n.from.getTime() && h.at.getTime() < n.to.getTime(),
            }}
          />
        </Inset>
      </Card>
    </Page>
  )
}
