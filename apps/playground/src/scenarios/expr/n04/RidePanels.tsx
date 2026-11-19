import { CartesianChart } from 'basalt-ui/charts'
import type { ChartFocus, ChartRefLine, ChartZone } from 'basalt-ui/charts'
import { BASALT, alpha } from 'basalt-ui/tokens'
import type { ReactElement } from 'react'
import { RIDE_SERIES } from '../../../demo/series'
import { useHourFormat } from './clock'
import { LIMITS } from './fixture'
import type { Hour, Stretch } from './fixture'

const RAIN_NAME = 'Rain chance'
const WIND_NAME = 'Wind'
const TEMP_NAME = 'Temperature'
/** The units and limits the page copy quotes too: one value each, so the axis, the limit rule and the subtitle agree. */
export const RAIN_UNIT = '%'
export const WIND_UNIT = 'km/h'
export const RAIN_MAX = LIMITS.rain
export const WIND_MAX = LIMITS.wind
export { RAIN_NAME, WIND_NAME }
const RAIN_AXIS = `${RAIN_NAME}, ${RAIN_UNIT}`
const WIND_AXIS = `${WIND_NAME}, ${WIND_UNIT}`
const TEMP_AXIS = `${TEMP_NAME}, °C`

/** The least the wind panel scales to: a gust past it is the kit's off-scale caret with its true value; a stormy fixture lifts it to the 80th percentile so the rest stays a line. */
const WIND_CAP = 50
const HOUR_MS = 3_600_000
/** One y gutter on all three panels, so their plots share one x. */
const GUTTER = 36
/** The accent ride window, a tint of the brand token. */
const WINDOW_FILL = alpha(BASALT.brand, 0.14)

/**
 * Rain chance, wind and temperature on one shared hour axis, one panel each: a unit apiece, the
 * rider's limit drawn on the two that have one, the ride windows as the one accent band across all
 * three. Only the rain panel takes the focus (one tab stop, one live region); the others follow the
 * shared cursor.
 */
export function RidePanels({
  hours,
  windows,
  focus,
}: {
  hours: readonly Hour[]
  windows: readonly Stretch[]
  focus: ChartFocus<Hour>
}): ReactElement {
  const { clock, day } = useHourFormat()
  const first = hours[0]?.at
  const last = hours.at(-1)?.at
  const domain: readonly [Date, Date] | undefined =
    first === undefined || last === undefined ? undefined : [first, last]
  const x = (ticks: readonly Date[]): Parameters<typeof CartesianChart<Hour>>[0]['x'] => ({
    value: (d) => d.at,
    format: (v) => (v instanceof Date ? clock(v) : String(v)),
    ticks,
    ...(domain === undefined ? {} : { domain }),
  })
  // owner-review-2: the kit gave stacked charts no shared plot box; the last tick is left off the temperature panel so its label reserve does not shift that plot's right edge off the other two.
  const sixHourly = hours
    .filter((d) => d.at.getUTCHours() % 6 === 0 && d !== hours.at(-1))
    .map((d) => d.at)
  const winds = hours.map((d) => d.wind).toSorted((a, b) => a - b)
  const windCap = Math.max(WIND_CAP, winds[Math.floor(winds.length * 0.8)] ?? 0)
  const zones = (named: boolean): readonly ChartZone[] =>
    windows.map((w) => ({
      axis: 'x',
      from: w.start,
      to: new Date(w.end.getTime() - HOUR_MS),
      fill: WINDOW_FILL,
      ...(named ? { label: `${w.to - w.from + 1} h` } : {}),
    }))
  const midnights = (named: boolean): readonly ChartRefLine[] =>
    hours
      .filter((d) => d.at.getUTCHours() === 0)
      .map((d) => ({
        axis: 'x',
        value: d.at,
        color: RIDE_SERIES.day,
        ...(named ? { label: day(d.at) } : {}),
      }))
  return (
    <div className="grid h-full grid-rows-3">
      <div className="min-h-0 [&>[data-basalt-chart]]:h-full">
        <CartesianChart
          label={RAIN_AXIS}
          height="fill"
          data={hours}
          focus={focus}
          tooltip={false}
          x={x([])}
          y={{
            title: RAIN_AXIS,
            domain: [0, 100],
            gutter: GUTTER,
          }}
          zones={zones(true)}
          refLines={[
            {
              value: RAIN_MAX,
              color: RIDE_SERIES.limit,
              dashed: true,
              label: `${RAIN_MAX}`,
            },
            ...midnights(true),
          ]}
          series={[
            {
              mark: 'bar',
              key: 'rain',
              label: RAIN_NAME,
              color: RIDE_SERIES.rain,
              legend: false,
              y: (d) => d.rain,
            },
          ]}
        />
      </div>
      <div className="min-h-0 [&>[data-basalt-chart]]:h-full">
        <CartesianChart
          label={WIND_AXIS}
          height="fill"
          data={hours}
          tooltip={false}
          x={x([])}
          y={{
            title: WIND_AXIS,
            gutter: GUTTER,
            domain: ([, hi]) => [0, Math.min(Math.max(hi, WIND_MAX + 5), windCap)],
          }}
          zones={zones(false)}
          refLines={[
            {
              value: WIND_MAX,
              color: RIDE_SERIES.limit,
              dashed: true,
              label: `${WIND_MAX}`,
            },
            ...midnights(false),
          ]}
          series={[
            {
              mark: 'line',
              key: 'wind',
              label: WIND_NAME,
              color: RIDE_SERIES.wind,
              legend: false,
              y: (d) => d.wind,
            },
          ]}
        />
      </div>
      <div className="min-h-0 [&>[data-basalt-chart]]:h-full">
        <CartesianChart
          label={TEMP_AXIS}
          height="fill"
          data={hours}
          tooltip={false}
          x={x(sixHourly)}
          y={{
            title: TEMP_AXIS,
            gutter: GUTTER,
            domain: ([lo, hi]) => [Math.floor(lo) - 1, Math.ceil(hi) + 1],
          }}
          zones={zones(false)}
          refLines={midnights(false)}
          series={[
            {
              mark: 'line',
              key: 'temp',
              label: TEMP_NAME,
              color: RIDE_SERIES.temp,
              legend: false,
              y: (d) => d.temp,
            },
          ]}
        />
      </div>
    </div>
  )
}
