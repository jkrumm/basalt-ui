import { text } from '@tanstack/charts/text'
import { DataPanel } from 'basalt-ui/cards'
import type { Phase, Tone } from 'basalt-ui/cards'
import { CartesianChart, ChartCard, chartLabels, useChartFocus } from 'basalt-ui/charts'
import type { ChartZone } from 'basalt-ui/charts'
import { Page, PageBar } from 'basalt-ui/page'
import { col, DataTable, useDataTable } from 'basalt-ui/table'
import { BASALT, alpha } from 'basalt-ui/tokens'
import { SPOT_WIND_SERIES } from '../../../demo/series'
import type { ScenarioProps } from '../../shot-state'
import { buildHours, fixtureName } from './fixture'
import type { Hour } from './fixture'
import {
  CAP_KT,
  GUSTY_ABOVE,
  HOUR_WORD,
  VERDICTS,
  RANGE,
  SECTOR,
  SURE,
  inSector,
  runsOf,
  stamp,
  stateOf,
  tenth,
  toKt,
  whole,
} from './model'
import type { Run, Verdict } from './model'

const FIXTURES = {
  default: buildHours('default'),
  calm: buildHours('calm'),
  storm: buildHours('storm'),
}
const NONE: readonly Hour[] = []
const SOURCE_DOWN = 'The forecast service did not answer. Retry in a moment.'
const NO_FORECAST = 'No forecast hours for this spot yet. Check back after the next model run.'
const HELD_FIGURE = { value: null, period: '', status: { tone: 'neutral', label: '' } } as const

const TONE: Record<Verdict, Tone> = {
  Steady: 'accent',
  Gusty: 'accent',
  Light: 'neutral',
  Strong: 'neutral',
  Offshore: 'bad',
}

const UNIT = 'kt'

const HEAD = {
  window: 'Window',
  verdict: 'Verdict',
  mean: 'Mean',
  gusts: 'Peak',
  ratio: 'Ratio',
}

const c = col<Run>()
const COLUMNS = [
  c.entity('label', { header: HEAD.window, mono: true, sortable: false, priority: 1 }),
  c.status('verdict', {
    header: HEAD.verdict,
    options: VERDICTS,
    tone: (v) => TONE[v],
    sortable: false,
    priority: 1,
  }),
  c.number('avgKt', { header: HEAD.mean, unit: UNIT, digits: 0, sortable: false, priority: 2 }),
  c.number('gustKt', { header: HEAD.gusts, unit: UNIT, digits: 0, sortable: false, priority: 2 }),
  c.number('ratio', { header: HEAD.ratio, unit: '×', digits: 1, sortable: false, priority: 3 }),
]

const pct = (d: Hour): number => Math.round(d.conf * 100)

const reading = (d: Hour): string =>
  `${stamp(d.at)}: ${whole(toKt(d.ms))} kt, gusts ${whole(toKt(d.g1))} kt, from ${d.dir}°`

type Status = { tone: Tone; label: string }

const hourStatus = (d: Hour): Status => {
  const state = stateOf(d)
  return {
    tone:
      state === 'ride'
        ? ('accent' as const)
        : state === 'offshore'
          ? ('bad' as const)
          : ('neutral' as const),
    label: HOUR_WORD[state],
  }
}

export function ExprN62Scenario({ shotState, fixture }: ScenarioProps) {
  const name = fixtureName(fixture)
  const loaded = FIXTURES[name]
  const ready = shotState === undefined
  const hours = ready ? loaded : NONE
  const runs = runsOf(hours)
  const rides = runs.filter((r) => r.state === 'ride')
  const best = rides.reduce<Run | undefined>(
    (a, r) => (a === undefined || r.hours > a.hours ? r : a),
    undefined,
  )

  const phase: Phase =
    shotState === 'loading'
      ? 'loading'
      : shotState === 'error'
        ? { tag: 'error', message: SOURCE_DOWN, retry: () => undefined }
        : 'ready'
  const empty = shotState === 'empty' ? { cause: NO_FORECAST } : null

  const focus = useChartFocus(hours, {
    announce: (d) =>
      `${reading(d)}; 3 h ${whole(toKt(d.g3))} kt, 6 h ${whole(toKt(d.g6))} kt; ${pct(d)}% sure`,
  })

  const table = useDataTable({
    id: 'wind-windows',
    label: 'Windows',
    columns: COLUMNS,
    data: runs,
    getRowId: (r) => r.id,
    mode: { kind: 'client' },
    // cycle-expression-13: a table in a half-width cell folds into phone cards at 750 px whatever its columns sum to, so it scrolls instead
    phone: 'scroll',
    phase,
    empty,
    bodyRows: runsOf(loaded).length,
  })

  const peak = hours.reduce<Hour | undefined>(
    (a, d) => (a === undefined || d.g1 > a.g1 ? d : a),
    undefined,
  )
  const firstOff = hours.find((d) => !inSector(d.dir))
  const usableHours = hours.filter((d) => inSector(d.dir)).length
  const unsure = hours.filter((d) => d.conf < SURE).length
  const rideHours = rides.reduce((s, r) => s + r.hours, 0)
  const longest = runs.reduce<Run | undefined>(
    (a, r) => (a === undefined || r.hours > a.hours ? r : a),
    undefined,
  )

  const windFigure = !ready
    ? HELD_FIGURE
    : {
        value: best?.label ?? 'No rideable hour',
        period: focus.readout(
          best === undefined
            ? `Peaks at ${whole(toKt(Math.max(...hours.map((d) => d.ms))))} kt`
            : rides.length === 1
              ? 'The only window'
              : `Longest of ${rides.length} windows`,
          reading,
        ),
        status: focus.readout(
          best === undefined
            ? { tone: 'neutral' as const, label: longest?.verdict ?? 'Light' }
            : { tone: 'accent' as const, label: `${best.verdict}, gusts ×${tenth(best.ratio)}` },
          hourStatus,
        ),
      }
  const windFooter = [
    { label: 'Hardest blow', value: ready && peak ? `${whole(toKt(peak.g1))} kt` : '' },
    { label: 'Rideable', value: ready ? `${rideHours} of ${hours.length} h` : '' },
  ] as const

  const dirFigure = !ready
    ? HELD_FIGURE
    : {
        value: firstOff ? `Offshore from ${stamp(firstOff.at)}` : 'No turn offshore',
        period: focus.readout(
          `Sector ${SECTOR.from}–${SECTOR.to}°`,
          (d) => `${stamp(d.at)}: ${d.dir}°, ${pct(d)}% confident`,
        ),
      }
  const dirFooter = [
    { label: 'Usable', value: ready ? `${usableHours} of ${hours.length} h` : '' },
    { label: `Under ${Math.round(SURE * 100)}% sure`, value: ready ? `${unsure} h` : '' },
  ] as const

  const ticks = hours.filter((d) => d.at.getUTCHours() % 6 === 0).map((d) => d.at)
  const x = {
    value: (d: Hour) => d.at,
    format: (v: number | Date | string) => (v instanceof Date ? stamp(v) : String(v)),
    ticks,
  }
  const first = hours[0]
  const last = hours.at(-1)

  return (
    <Page area="wind">
      <PageBar title="Kitesurf spot, next 48 hours" />
      <ChartCard
        title="Wind and gusts"
        subtitle="Hourly at 10 m; peaks taken over the last 1, 3 or 6 h"
        height="tall"
        phase={phase}
        empty={empty}
        figure={windFigure}
        footer={windFooter}
        chart={() => (
          <CartesianChart
            label="Knots by hour"
            data={hours}
            focus={focus}
            tooltip={false}
            x={x}
            y={{
              title: 'Knots',
              domain: ([, hi]) => [0, Math.max(RANGE.max + 5, Math.min(hi, CAP_KT))],
            }}
            series={[
              {
                mark: 'line',
                key: 'gust6',
                format: (v) => `${whole(v)} kt`,
                label: 'Gust 6 h',
                color: SPOT_WIND_SERIES.gust6,
                dash: true,
                weight: 'quiet',
                y: (d) => toKt(d.g6),
              },
              {
                mark: 'line',
                key: 'gust3',
                format: (v) => `${whole(v)} kt`,
                label: 'Gust 3 h',
                color: SPOT_WIND_SERIES.gust3,
                dash: true,
                weight: 'quiet',
                y: (d) => toKt(d.g3),
              },
              {
                mark: 'line',
                key: 'gust1',
                format: (v) => `${whole(v)} kt`,
                label: 'Gust 1 h',
                color: SPOT_WIND_SERIES.gust1,
                weight: 'quiet',
                y: (d) => toKt(d.g1),
              },
              {
                mark: 'line',
                key: 'wind',
                format: (v) => `${whole(v)} kt`,
                label: 'Wind',
                color: SPOT_WIND_SERIES.wind,
                weight: 'strong',
                y: (d) => toKt(d.ms),
              },
            ]}
            refLines={[
              {
                value: RANGE.min,
                color: SPOT_WIND_SERIES.range,
                dashed: true,
                label: `${RANGE.min} kt`,
              },
              {
                value: RANGE.max,
                color: SPOT_WIND_SERIES.range,
                dashed: true,
                label: `${RANGE.max} kt`,
              },
            ]}
            zones={runs.flatMap((r): ChartZone[] =>
              r.state === 'ride'
                ? [
                    {
                      axis: 'x',
                      from: r.from,
                      to: r.to,
                      y: { from: RANGE.min, to: RANGE.max },
                      fill: alpha(BASALT.brand, 0.16),
                      label: `${r.verdict}, ${r.hours} h`,
                    },
                  ]
                : r.state === 'offshore'
                  ? [
                      {
                        axis: 'x',
                        from: r.from,
                        to: r.to,
                        fill: alpha(BASALT.bad, 0.1),
                        label: r.verdict,
                      },
                    ]
                  : [],
            )}
            marks={CartesianChart.custom<Hour>((plot) => {
              const end = plot.data.at(-9)
              const endX = end === undefined ? null : plot.x(end.at)
              if (end === undefined || endX === null) return []
              const at = new Map<string, { at: Date; kt: number; text: string }>()
              for (const s of plot.visible) {
                const v = s.y(end)
                if (v !== null) at.set(s.key, { at: end.at, kt: v, text: s.label })
              }
              if (peak !== undefined && toKt(peak.g1) <= CAP_KT) {
                at.set('peak', {
                  at: peak.at,
                  kt: toKt(peak.g1),
                  text: `${whole(toKt(peak.g1))} kt`,
                })
              }
              const items = [...at].flatMap(([key, a]) => {
                const px = plot.x(a.at)
                return px === null
                  ? []
                  : [
                      {
                        key,
                        text: a.text,
                        x: px,
                        y: plot.y(a.kt),
                        priority: key === 'peak' ? 2 : 1,
                      },
                    ]
              })
              const { placed } = chartLabels.place(items, {
                width: plot.plotWidth,
                height: plot.plotHeight,
              })
              return [
                text(placed, {
                  x: (l) => at.get(l.key)?.at ?? end.at,
                  y: (l) => at.get(l.key)?.kt ?? 0,
                  text: (l) => l.text,
                  dx: (l) => l.dx,
                  dy: (l) => l.dy,
                  anchor: (l) => l.textAnchor,
                  fill: BASALT.ink,
                  fontSize: BASALT.text.micro,
                }),
              ]
            })}
          />
        )}
      />
      <div className="grid gap-4 @wide:grid-cols-2">
        <DataPanel
          title="Windows by state"
          subtitle={`Ride needs ${RANGE.min}–${RANGE.max} kt from ${SECTOR.from}–${SECTOR.to}°; gusty above ×${GUSTY_ABOVE}`}
          phase={phase}
          empty={empty}
          bodySize={{ rows: runsOf(loaded).length + 1 }}
          body={() => (
            <DataTable
              table={table}
              focusItems={{ focus, holds: (r, d) => d.at >= r.from && d.at < r.to }}
            />
          )}
        />
        <ChartCard
          title="Wind direction"
          subtitle="Degrees it blows from; a larger dot is surer"
          height="short"
          phase={phase}
          empty={empty}
          figure={dirFigure}
          footer={dirFooter}
          chart={() => (
            <CartesianChart
              label="Degrees by hour"
              data={hours}
              focus={focus}
              tooltip={false}
              x={x}
              y={{
                domain: ([lo, hi]) => [Math.min(lo, SECTOR.from), Math.max(hi, SECTOR.to)],
                format: (v) => `${v}°`,
              }}
              series={[
                {
                  mark: 'dot',
                  key: 'usable',
                  label: 'In sector',
                  color: SPOT_WIND_SERIES.usable,
                  y: (d) => (inSector(d.dir) ? d.dir : null),
                  r: (d) => 1.5 + 2.5 * d.conf,
                },
                {
                  mark: 'dot',
                  key: 'off',
                  label: 'Outside',
                  color: SPOT_WIND_SERIES.offshore,
                  y: (d) => (inSector(d.dir) ? null : d.dir),
                  r: (d) => 1.5 + 2.5 * d.conf,
                },
              ]}
              zones={
                first && last
                  ? [
                      {
                        axis: 'x',
                        from: first.at,
                        to: last.at,
                        y: { from: SECTOR.from, to: SECTOR.to },
                        fill: alpha(BASALT.inkMuted, 0.12),
                        label: 'Usable',
                      },
                    ]
                  : []
              }
            />
          )}
        />
      </div>
    </Page>
  )
}
