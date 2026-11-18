import { rect } from '@tanstack/charts/rect'
import { text } from '@tanstack/charts/text'
import { useLayoutEffect, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { DataPanel } from 'basalt-ui/cards'
import type { Phase } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, useChartFocus } from 'basalt-ui/charts'
import type { ChartFigure, LegendEntry } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { BASALT } from 'basalt-ui/tokens'
import { ScrollArea } from 'basalt-ui/ui/scroll-area'
import { RIDE_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { bestRun, clock, forecastFor, hourLabel, isRide, runsOf } from './fixture'
import type { Hour, Run } from './fixture'

/** The y axis is the share of the rider's own limit, so one rule at 100 is both limits. */
const Y_CEIL = 150
/** Fill opacities of the ride bands: best or focused, the rest, and the rest while one is focused. */
const BAND_BEST = 0.24
const BAND_REST = 0.12
const BAND_DIM = 0.08
const CURSOR_FILL = 0.3
/** Above the 100% rule: inside a ride window both lines are below it, so the label has room. */
const BEST_LABEL_Y = 125
const HOUR_MS = 3_600_000
/** The fixture clock is wall time, so the axis takes a fixed instant and no zone enters. */
const T0 = Date.UTC(2026, 10, 16, 23)
const at = (i: number): Date => new Date(T0 + i * HOUR_MS)
/** Every sixth wall-clock hour (00, 06, 12, 18) of the 48 h forecast that starts at 23:00. */
const TICKS = [1, 7, 13, 19, 25, 31, 37, 43].map(at)

const share = (value: number, limit: number): number => Math.round((value / limit) * 100)

const tickLabel = (i: number): string => {
  const { day, time } = clock(i)
  return time === '00:00' ? day : time
}

const readHour = (h: Hour): string => `${h.rain}% rain, ${h.wind} km/h wind, ${h.temp} °C`
const shortHour = (h: Hour): string => `${h.rain}% rain, ${h.wind} km/h`

/**
 * cycle-expression-4: a chart told `fill` floors at 320 px inside a ChartCard box that is 192 px
 * at a phone width, so the axis is clipped; the box's pixel height is read and passed.
 */
function BoxHeight({ children }: { children: (height: number) => ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (el === null) return
    const observer = new ResizeObserver(() => setHeight(el.clientHeight))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} className="h-full">
      {height > 0 ? children(height) : null}
    </div>
  )
}

// cycle-expression-4: a consumer-marks chart box cannot take its legend (it is drawn below the given height), so the card's seam legend names the series
const LEGEND: readonly LegendEntry[] = [
  { key: 'rain', label: 'Rain chance', color: RIDE_SERIES.rain, swatch: 'solid' },
  { key: 'wind', label: 'Wind', color: RIDE_SERIES.wind, swatch: 'solid' },
  { key: 'limit', label: 'Your limit', color: RIDE_SERIES.limit, swatch: 'dashed' },
]

export function ExprN04Scenario({ shotState, fixture }: ScenarioProps) {
  const [retried, setRetried] = useState(false)
  const { hours: all, limits } = forecastFor(fixture)
  const hours = shotState === 'empty' ? [] : all
  const runs = runsOf(hours, limits)
  const best = bestRun(runs)
  const rideRuns = runs.filter((r) => r.ride)
  const next = rideRuns
    .filter((r) => r !== best)
    .reduce<Run | null>((top, r) => (top === null || r.hours > top.hours ? r : top), null)
  const temps = {
    low: Math.min(...hours.map((h) => h.temp)),
    high: Math.max(...hours.map((h) => h.temp)),
  }
  const yTop = Math.max(
    Y_CEIL,
    ...hours.map((h) => Math.max(share(h.rain, limits.rain), share(h.wind, limits.wind))),
  )

  const runOf = (h: Hour): Run | undefined => runs.find((r) => h.i >= r.from && h.i <= r.to)
  const focus = useChartFocus(hours, {
    announce: (h) => `${hourLabel(h.i)}: ${readHour(h)}. ${isRide(h, limits) ? 'Ride' : 'Skip'}`,
    group: (h) => runOf(h)?.id ?? '',
  })

  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error' && !retried
        ? {
            tag: 'error',
            message: 'The forecast service did not answer.',
            retry: () => setRetried(true),
          }
        : 'ready'
  const filled = phase === 'ready' && hours.length > 0
  const noForecast = { cause: 'No forecast hours came back for this place. Pick another place.' }

  const allClear = best !== null && best.hours === hours.length
  const hero =
    best === null ? 'No window' : allClear ? `Ride all ${best.hours} h` : `Ride ${best.short}`
  const lead = best !== null && next !== null ? best.hours - next.hours : 0
  const hovered = focus.datum
  const figure: ChartFigure = {
    value: focus.readout(hero, (h) => hourLabel(h.i)),
    period: focus.readout(best === null ? 'over your limits' : '', shortHour),
  }
  if (hovered !== null) {
    figure.status = isRide(hovered, limits)
      ? { tone: 'good', label: 'Ride' }
      : { tone: 'neutral', label: 'Skip' }
  } else if (best === null) {
    figure.status = { tone: 'neutral', label: 'Stay in' }
  } else if (lead > 0) {
    figure.delta = { value: `+${lead} h`, polarity: 'up-good' }
  }

  const facts: Pick<ComponentProps<typeof ChartCard>, 'figure' | 'footer'> = filled
    ? {
        figure,
        footer: [
          {
            label: 'Temperature',
            value: focus.readout(`${temps.low} to ${temps.high} °C`, (h) => `${h.temp} °C`),
          },
        ],
      }
    : {}

  const windowsPanel = (
    <DataPanel
      title="Ride windows"
      subtitle={`${rideRuns.reduce((n, r) => n + r.hours, 0)} of ${hours.length} h under both limits`}
      phase={phase}
      empty={
        hours.length === 0 || rideRuns.length > 0
          ? null
          : { cause: 'Nothing stays under both limits. Check again after the next forecast.' }
      }
      bodySize={{ rows: Math.max(rideRuns.length, 3) }}
      body={() => (
        <ScrollArea aria-label="Ride windows" onPointerLeave={focus.target.onPointerLeave}>
          {rideRuns.map((r) => (
            <div
              key={r.id}
              {...focus.groupItem(r.id)}
              className="flex justify-between gap-2 border-b px-3 py-2 text-sm data-focused:bg-selected"
            >
              <span className="font-mono tabular-nums">{r.label}</span>
              <span className="tabular-nums">{r.hours} h</span>
            </div>
          ))}
        </ScrollArea>
      )}
    />
  )

  return (
    <Page area="ride-windows">
      <PageBar title="Cycling, next 48 hours" />
      <div className="grid items-start gap-3 @wide:grid-cols-2">
        <ChartCard
          title="Dry and calm hours"
          subtitle={
            filled
              ? `From ${hourLabel(0)}${lead > 0 ? ', best window vs next' : ''}`
              : `From ${hourLabel(0)}`
          }
          phase={phase}
          empty={hours.length === 0 ? noForecast : null}
          legend={LEGEND}
          {...facts}
          chart={() => (
            <BoxHeight>
              {(height) => (
                <CartesianChart<Hour>
                  height={height}
                  ariaLabel="Rain chance and wind for the next 48 hours, each as a share of your limit"
                  data={hours}
                  focus={focus}
                  x={{
                    value: (h) => at(h.i),
                    format: (x) => tickLabel(Math.round((new Date(x).getTime() - T0) / HOUR_MS)),
                    ticks: TICKS,
                  }}
                  y={{
                    domain: { floor: 0, ceil: Y_CEIL, pad: 0.05 },
                    title: `Share of limit: ${limits.rain}% rain, ${limits.wind} km/h`,
                    format: (v) => `${v}%`,
                  }}
                  tooltip={{
                    formatHeader: (h) => hourLabel(h.i),
                    rows: (h) => [{ label: 'Temperature', value: `${h.temp} °C` }],
                  }}
                  refLines={[
                    { value: 100, color: RIDE_SERIES.limit, dashed: true, label: 'Limit' },
                  ]}
                  series={[
                    {
                      // cycle-expression-4: a rect band did not draw on a bar series' axis, so rain is a step line, not bars
                      mark: 'line',
                      curve: 'stepAfter',
                      weight: 'quiet',
                      key: 'rain',
                      label: `Rain chance, limit ${limits.rain}%`,
                      color: RIDE_SERIES.rain,
                      legend: false,
                      y: (h) => share(h.rain, limits.rain),
                      format: (_v, h) => `${h.rain}%`,
                    },
                    {
                      mark: 'line',
                      key: 'wind',
                      label: `Wind, limit ${limits.wind} km/h`,
                      color: RIDE_SERIES.wind,
                      weight: 'strong',
                      legend: false,
                      y: (h) => share(h.wind, limits.wind),
                      format: (_v, h) => `${h.wind} km/h`,
                    },
                  ]}
                  // cycle-expression-4: no x-range band or direct line label in the kit (zones are y ranges), so ride windows are engine rects and labels engine text marks
                  marks={CartesianChart.custom<Hour>((plot) => {
                    const focusedRun = plot.focused === null ? undefined : runOf(plot.focused)
                    const band = (r: Run): number => {
                      if (focusedRun !== undefined) return r === focusedRun ? BAND_BEST : BAND_DIM
                      return r === best ? BAND_BEST : BAND_REST
                    }
                    const bands = rideRuns.map((r) =>
                      rect([r], {
                        id: `band-${r.from}`,
                        x1: (d: Run) => at(d.from - 0.5),
                        x2: (d: Run) => at(d.to + 0.5),
                        y1: () => 0,
                        y2: () => yTop,
                        fill: BASALT.brand,
                        fillOpacity: band(r),
                      }),
                    )
                    const cursor =
                      plot.focused === null
                        ? []
                        : [
                            rect([plot.focused], {
                              id: 'hour',
                              x1: (d: Hour) => at(d.i - 0.5),
                              x2: (d: Hour) => at(d.i + 0.5),
                              y1: () => 0,
                              y2: () => yTop,
                              fill: BASALT.brand,
                              fillOpacity: CURSOR_FILL,
                            }),
                          ]
                    const mark =
                      best === null
                        ? []
                        : [
                            text([best], {
                              id: 'best-name',
                              x: (r: Run) => at((r.from + r.to) / 2),
                              y: () => BEST_LABEL_Y,
                              text: (r: Run) =>
                                next === null ? `${r.hours} h` : `Best ${r.hours} h`,
                              anchor: () => 'middle' as const,
                              fill: BASALT.ink,
                              fontSize: BASALT.text.xs,
                            }),
                          ]
                    return [...bands, ...cursor, ...mark]
                  })}
                />
              )}
            </BoxHeight>
          )}
        />
        {phase === 'loading' || (phase === 'ready' && hours.length > 0) ? windowsPanel : null}
      </div>
    </Page>
  )
}
